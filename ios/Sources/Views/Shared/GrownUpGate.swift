import SwiftUI

/// A sum a five-year-old can't do: two two-digit numbers multiplied together.
struct GrownUpQuestion: Equatable, Sendable {
    let left: Int
    let right: Int

    var prompt: String { "What is \(left) × \(right)?" }
    var answer: Int { left * right }

    /// A new question, different from `previous` so a wrong guess never sees the same sum twice in a row.
    static func random(avoiding previous: GrownUpQuestion? = nil,
                       using generator: inout some RandomNumberGenerator) -> GrownUpQuestion {
        while true {
            // 12–19 keeps it quick for a grown-up and out of reach of times tables.
            let question = GrownUpQuestion(left: Int.random(in: 12...19, using: &generator),
                                           right: Int.random(in: 12...19, using: &generator))
            if question != previous { return question }
        }
    }

    static func random(avoiding previous: GrownUpQuestion? = nil) -> GrownUpQuestion {
        var generator = SystemRandomNumberGenerator()
        return random(avoiding: previous, using: &generator)
    }

    /// True when the typed text is the answer. Spaces around it are fine; anything else is not.
    func accepts(_ typed: String) -> Bool {
        Int(typed.trimmingCharacters(in: .whitespacesAndNewlines)) == answer
    }
}

/// Remembers that a grown-up answered, until the app is closed. Never saved.
@MainActor
@Observable
final class GrownUpSession {
    static let shared = GrownUpSession()

    private(set) var isUnlocked: Bool
    private(set) var question: GrownUpQuestion

    init(isUnlocked: Bool = GrownUpSession.skipsGate, question: GrownUpQuestion = .random()) {
        self.isUnlocked = isUnlocked
        self.question = question
    }

    /// Unlocks on the right answer; on a wrong one, asks a new question. Returns whether it unlocked.
    @discardableResult
    func submit(_ typed: String) -> Bool {
        if question.accepts(typed) {
            isUnlocked = true
        } else {
            question = .random(avoiding: question)
        }
        return isUnlocked
    }

    /// UI tests launch with `-silent` and walk straight into the Grown-ups tab. Debug builds only.
    static var skipsGate: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-silent")
        #else
        false
        #endif
    }
}

/// Shows its content only after a grown-up answers a question, once per app session.
struct GrownUpGate<Content: View>: View {
    @State private var session = GrownUpSession.shared
    @State private var typed = ""
    @State private var wrong = false
    @FocusState private var focused: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        if session.isUnlocked {
            content()
        } else {
            VStack(alignment: .leading, spacing: 18) {
                Overline(text: "Grown-ups only")
                Text("Ask a grown-up to answer")
                    .font(Typeface.headline(34))
                    .foregroundStyle(Palette.textPrimary)
                Text(session.question.prompt)
                    .font(Typeface.headline(44))
                    .foregroundStyle(Palette.gold)
                    .accessibilityIdentifier("grownUpQuestion")
                TextField("", text: $typed, prompt: Text("Answer").foregroundStyle(Palette.textMuted))
                    .keyboardType(.numberPad)
                    .focused($focused)
                    .font(Typeface.body(22))
                    .padding(.horizontal, 12)
                    .frame(height: 56)
                    .background(Palette.ground2)
                    .overlay(Rectangle().stroke(Palette.borderStrong, lineWidth: 1))
                    .foregroundStyle(Palette.textPrimary)
                    .accessibilityIdentifier("grownUpAnswer")
                if wrong {
                    Text("Not quite. Here's a new one.")
                        .font(Typeface.body(14))
                        .foregroundStyle(Palette.textSecondary)
                }
                Button("Open") {
                    wrong = !session.submit(typed)
                    typed = ""
                }
                .buttonStyle(GoldButtonStyle())
                .disabled(typed.isEmpty)
                .opacity(typed.isEmpty ? 0.5 : 1)
                .accessibilityIdentifier("grownUpOpen")
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Palette.ground1.ignoresSafeArea())
            .onTapGesture { focused = false }
        }
    }
}
