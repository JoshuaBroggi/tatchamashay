import Testing
@testable import Tatchamashay

@Suite("Grown-up gate")
@MainActor
struct GrownUpGateTests {
    @Test("Every question multiplies two two-digit numbers")
    func questionsAreTwoDigitMultiplication() {
        var generator = SystemRandomNumberGenerator()
        for _ in 0..<200 {
            let question = GrownUpQuestion.random(using: &generator)
            #expect((10...99).contains(question.left))
            #expect((10...99).contains(question.right))
            #expect(question.answer == question.left * question.right)
            #expect(question.answer >= 100)
        }
    }

    @Test("The prompt shows both numbers")
    func prompt() {
        #expect(GrownUpQuestion(left: 13, right: 17).prompt == "What is 13 × 17?")
    }

    @Test("Only the exact answer is accepted")
    func accepts() {
        let question = GrownUpQuestion(left: 13, right: 17)
        #expect(question.accepts("221"))
        #expect(question.accepts(" 221\n"))
        #expect(!question.accepts("220"))
        #expect(!question.accepts(""))
        #expect(!question.accepts("13"))
        #expect(!question.accepts("two hundred"))
    }

    @Test("A new question is never the one just asked")
    func newQuestionDiffers() {
        var generator = SystemRandomNumberGenerator()
        let first = GrownUpQuestion(left: 12, right: 12)
        for _ in 0..<500 {
            #expect(GrownUpQuestion.random(avoiding: first, using: &generator) != first)
        }
    }

    @Test("A wrong answer keeps it locked and asks a new question")
    func wrongAnswer() {
        let first = GrownUpQuestion(left: 14, right: 15)
        let session = GrownUpSession(isUnlocked: false, question: first)
        #expect(!session.submit("1"))
        #expect(!session.isUnlocked)
        #expect(session.question != first)
    }

    @Test("The right answer unlocks for the rest of the session")
    func rightAnswer() {
        let session = GrownUpSession(isUnlocked: false, question: GrownUpQuestion(left: 14, right: 15))
        #expect(session.submit("210"))
        #expect(session.isUnlocked)
        // Stays open whatever is typed afterwards.
        #expect(session.submit("nonsense"))
        #expect(session.isUnlocked)
    }
}
