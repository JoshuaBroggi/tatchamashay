import Foundation
import Observation

/// Everything the guide can say for one adventure, already tied to the family: the guide's line bank,
/// the starter story (if the adventure came from one), the child's and grown-up's names, and the
/// parent's hints in play order.
struct GuideScript: Sendable {
    var guide: GuideStory
    var story: AdventureStory?
    var context: StoryContext
    /// The adventure's goal. A starter story's goal wins over this.
    var goal: String
    /// The adventure's closing line, used when there's no starter story.
    var closing: String
    /// The parent's hint for each treasure, in play order.
    var hints: [String]
    /// Each treasure's `storyTreasureID`, in play order, for its reveal line.
    var storyTreasureIDs: [String?]
    /// The placements in play order, to find a hunt moment's treasure.
    var placementIDs: [ChestPlacement.ID] = []

    var rate: Double { guide.voice.ttsRate }

    /// Greeting, then the goal in one spoken sentence, wrapped in the guide's goal lines.
    func opening(using random: inout some RandomNumberGenerator) -> [String] {
        guide.lines(for: .greeting, context: context, using: &random)
            + guide.lines(for: .goalBefore, context: context, using: &random)
            + context.fill([story?.goal ?? goal])
            + guide.lines(for: .goalAfter, context: context, using: &random)
    }

    /// The lines for a hunt moment about treasure `index`. Empty means say nothing.
    func lines(for moment: GuideMoment, treasure index: Int,
               using random: inout some RandomNumberGenerator) -> [String] {
        switch moment {
        case .hint:
            return hint(index, using: &random)
        case .nextTreasure:
            let clue = hint(index, using: &random)
            return guide.lines(for: .nextTreasure, context: context, using: &random) + clue
        case .reveal:
            let own = storyTreasureIDs[safe: index].flatMap { $0 }
                .flatMap { story?.treasure($0)?.reveal }
                .flatMap(context.fill)
            return guide.lines(for: .reveal, context: context, using: &random) + (own.map { [$0] } ?? [])
        case .finale:
            return finale(using: &random)
        case .greeting, .goalBefore, .goalAfter:
            return opening(using: &random)
        default:
            return guide.lines(for: moment, context: context, using: &random)
        }
    }

    /// The story's finale lines (ending "Back to the ship!"), then the guide's own.
    func finale(using random: inout some RandomNumberGenerator) -> [String] {
        let own = story.map { context.fill($0.finale) } ?? []
        return (own.isEmpty ? context.fill([closing]) : own)
            + guide.lines(for: .finale, context: context, using: &random)
    }

    /// The guide's lead-in, then the parent's hint. Nothing if the parent left no hint.
    private func hint(_ index: Int, using random: inout some RandomNumberGenerator) -> [String] {
        guard let clue = hints[safe: index]?.trimmed, !clue.isEmpty else { return [] }
        return guide.lines(for: .hint, context: context, using: &random) + [clue]
    }
}

/// Decides what the guide says and when, so lines never stack and nothing talks over the reveal.
///
/// - One utterance at a time. A new line either replaces the current one (stopping the voice first)
///   or waits/drops: chatter such as "getting close" never interrupts something more important.
/// - A find (`reveal` by Dig!, `we_found_it` by the grown-up) silences the guide while the chest
///   bursts open, then it says the find's lines. Moments that arrive meanwhile wait their turn.
/// - The finale plays once per run.
///
/// Time comes from `now`, and `tick()` moves things along, so tests run without waiting.
@MainActor
@Observable
final class GuideDirector {
    enum Phase: Equatable {
        /// Nothing to play: no adventure, or no run.
        case idle
        /// The greeting and goal, before the child sets off.
        case opening
        case hunting
        /// The chest is bursting open. The guide is quiet.
        case holdingForReveal
        case finale
        /// The finale is done; only taps to repeat remain.
        case ended
    }

    /// How important a line is. A line only interrupts one at its level or below.
    enum Priority: Int, Comparable {
        /// "Getting close", "foggy": dropped when the guide is already talking.
        case chatter
        /// Hints, Dig ready, We found it, next treasure: wait for a bigger line, interrupt chatter.
        case action
        /// The opening, the reveal and the finale.
        case big

        static func < (a: Priority, b: Priority) -> Bool { a.rawValue < b.rawValue }

        init(_ moment: GuideMoment) {
            switch moment {
            case .gettingClose, .foggyGPS: self = .chatter
            case .reveal, .finale, .greeting, .goalBefore, .goalAfter: self = .big
            default: self = .action
            }
        }
    }

    private(set) var phase: Phase = .idle
    /// What the speech bubble shows. Nil when the guide is quiet.
    private(set) var bubble: String?
    /// The moment behind the current line, for the drawing's mood.
    private(set) var mood: GuideMoment?
    private(set) var runID: UUID?
    var script: GuideScript?

    /// How long the guide stays quiet after the chest starts opening. The chest's burst and rise
    /// take about 2.2 s (`ChestOpeningView`).
    var revealHold: TimeInterval = 2.5
    /// The same chatter for the same treasure isn't repeated within this time.
    var chatterCooldown: TimeInterval = 20
    /// How long the opening stays up after its lines end, if nobody taps Let's go.
    var openingLinger: TimeInterval = 6

    private let voice: any GuideVoice
    private let sounds: any SoundEffects
    private let now: () -> Date
    private var random: GuideRandom

    private var current: Priority?
    private var busyUntil = Date.distantPast
    private var lastLines: [String] = []
    private var holdUntil = Date.distantPast
    private var revealIndex = 0
    private var revealByGrownUp = false
    private var pending: [Moment] = []
    private var lastHeard: [String: Date] = [:]
    private var finaleRuns: Set<UUID> = []
    private var openingDoneAt: Date?

    init(voice: any GuideVoice, sounds: any SoundEffects, now: @escaping () -> Date = { .now },
         random: any RandomNumberGenerator = SystemRandomNumberGenerator()) {
        self.voice = voice
        self.sounds = sounds
        self.now = now
        self.random = GuideRandom(random)
    }

    /// Whether a line is on screen (and probably being spoken).
    var isTalking: Bool { bubble != nil }
    var finaleHasPlayed: Bool { runID.map(finaleRuns.contains) ?? false }

    // MARK: Runs

    /// Starts following a run. A new run with nothing found yet opens with the greeting and goal;
    /// a run already under way (after a restart) picks up quietly; a finished run stays finished.
    func begin(run: UUID, script: GuideScript, foundCount: Int, isComplete: Bool) {
        self.script = script
        guard run != runID else { return }
        silence()
        runID = run
        pending = []
        lastHeard = [:]
        if isComplete || finaleRuns.contains(run) {
            phase = .ended
        } else if foundCount == 0 {
            phase = .opening
            openingDoneAt = nil
            say(script.opening(using: &random), priority: .big, mood: .greeting)
        } else {
            phase = .hunting
        }
    }

    /// No adventure to play.
    func reset() {
        silence()
        phase = .idle
        runID = nil
        script = nil
        pending = []
    }

    /// The child taps Let's go, or the opening times out: give the first clue.
    func finishOpening() {
        guard phase == .opening else { return }
        phase = .hunting
        openingDoneAt = nil
        silence()
        handle(Moment(moment: .hint, treasureIndex: 0))
    }

    /// The child taps Back to the ship!: say goodbye and end.
    func finishFinale() {
        guard phase == .finale, let script else { return }
        phase = .ended
        say(script.guide.lines(for: .goodbye, context: script.context, using: &random), priority: .big, mood: .goodbye)
    }

    // MARK: Moments

    /// A moment from the hunt (`AppModel.huntMoment`).
    func handle(_ event: HuntMomentEvent) {
        guard let script else { return }
        let index = event.placementID.flatMap { script.placementIDs.firstIndex(of: $0) } ?? event.treasureNumber - 1
        handle(Moment(moment: event.moment, treasureIndex: index))
    }

    /// A moment about one treasure, 0-based in play order.
    struct Moment: Equatable {
        var moment: GuideMoment
        var treasureIndex: Int
    }

    private func handle(_ moment: Moment) {
        guard let script else { return }
        // The opening already greeted the child and said the goal.
        if moment.moment == .greeting { return }
        switch phase {
        case .idle, .ended, .finale:
            return
        case .opening:
            // Only a find (or the end) cuts the opening short; clues come after it.
            guard [.digReady, .weFoundIt, .reveal, .finale].contains(moment.moment) else { return }
            openingDoneAt = nil
            phase = .hunting
            silence()
        case .holdingForReveal:
            if Priority(moment.moment) > .chatter { pending.append(moment) }
            return
        case .hunting:
            break
        }

        switch moment.moment {
        case .reveal, .weFoundIt:
            // The chest is opening, by Dig! or by the grown-up.
            silence()
            phase = .holdingForReveal
            holdUntil = now().addingTimeInterval(revealHold)
            revealIndex = moment.treasureIndex
            revealByGrownUp = moment.moment == .weFoundIt
        case .finale:
            playFinale()
        default:
            let priority = Priority(moment.moment)
            if let current, isTalking, priority < current {
                // Never drop a clue: wait for the bigger line to finish.
                if priority == .action { pending.append(moment) }
                return
            }
            if priority == .chatter {
                let key = "\(moment.moment.rawValue)#\(moment.treasureIndex)"
                if let heard = lastHeard[key], now().timeIntervalSince(heard) < chatterCooldown { return }
                lastHeard[key] = now()
            }
            say(script.lines(for: moment.moment, treasure: moment.treasureIndex, using: &random),
                priority: priority, mood: moment.moment)
        }
    }

    /// Moves time along: ends the reveal hold, clears a finished line, and plays what was waiting.
    /// The overlay calls this a few times a second.
    func tick() {
        let time = now()
        if phase == .holdingForReveal {
            guard time >= holdUntil, let script else { return }
            phase = .hunting
            let thanks = revealByGrownUp ? script.lines(for: .weFoundIt, treasure: revealIndex, using: &random) : []
            say(thanks + script.lines(for: .reveal, treasure: revealIndex, using: &random), priority: .big, mood: .reveal)
            return
        }
        if isTalking {
            guard time >= busyUntil, !voice.isSpeaking else { return }
            if phase == .opening {
                // The opening's words stay up a while for a slow look, then the first clue plays.
                let done = openingDoneAt ?? time
                openingDoneAt = done
                if time >= done.addingTimeInterval(openingLinger) { finishOpening() }
                return
            }
            bubble = nil
            current = nil
        }
        if phase == .hunting { playPending() }
    }

    /// The child taps the guide: say the last line again. Not during the reveal.
    func repeatLast() {
        guard phase != .holdingForReveal, phase != .idle, !lastLines.isEmpty else { return }
        say(lastLines, priority: current ?? .action, mood: mood)
    }

    // MARK: Speaking

    private func playPending() {
        guard !pending.isEmpty else { return }
        let next = pending.removeFirst()
        handle(next)
    }

    private func playFinale() {
        guard let run = runID, !finaleRuns.contains(run), let script else { return }
        finaleRuns.insert(run)
        pending = []
        phase = .finale
        sounds.play(.finaleFanfare)
        say(script.finale(using: &random), priority: .big, mood: .finale)
    }

    private func say(_ lines: [String], priority: Priority, mood: GuideMoment?) {
        guard !lines.isEmpty, let script else { return }
        if isTalking || voice.isSpeaking { voice.stop() }
        voice.speak(lines, rate: script.rate)
        lastLines = lines
        bubble = lines.joined(separator: " ")
        current = priority
        self.mood = mood
        busyUntil = now().addingTimeInterval(Self.estimatedDuration(of: lines, rate: script.rate))
    }

    private func silence() {
        if isTalking || voice.isSpeaking { voice.stop() }
        bubble = nil
        current = nil
    }

    /// Roughly how long the lines take to say, so the bubble stays up even with a silent voice.
    /// About 2.5 words a second at normal speed, plus the pause between lines and a moment for a
    /// grown-up to finish reading.
    static func estimatedDuration(of lines: [String], rate: Double) -> TimeInterval {
        let words = lines.reduce(0) { $0 + $1.split(separator: " ").count }
        let speed = 2.5 * max(rate, 0.1) / 0.5
        return Double(words) / speed + 0.4 * Double(lines.count) + 2
    }
}

/// Holds any random number generator, so the director can take a seeded one in tests.
struct GuideRandom: RandomNumberGenerator {
    private var base: any RandomNumberGenerator

    init(_ base: any RandomNumberGenerator) { self.base = base }

    mutating func next() -> UInt64 { base.next() }
}

fileprivate extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
