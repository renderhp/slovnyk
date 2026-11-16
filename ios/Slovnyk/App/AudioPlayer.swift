import AVFoundation
import Observation

/// Streams pronunciation audio from Wikimedia Commons.
@MainActor
@Observable
final class AudioPlayer {
    private(set) var playingURL: URL?
    private(set) var failedURL: URL?
    private var player: AVPlayer?
    private var observation: Task<Void, Never>?

    func play(_ url: URL) {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        observation?.cancel()
        let item = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: item)
        playingURL = url
        failedURL = nil
        player?.play()

        observation = Task { [weak self] in
            let center = NotificationCenter.default
            await withTaskGroup(of: Bool.self) { group in
                group.addTask { for await _ in center.notifications(named: AVPlayerItem.didPlayToEndTimeNotification, object: item) { return true }; return true }
                group.addTask { for await _ in center.notifications(named: AVPlayerItem.failedToPlayToEndTimeNotification, object: item) { return false }; return false }
                let finished = await group.next() ?? true
                group.cancelAll()
                await MainActor.run {
                    guard let self, self.playingURL == url else { return }
                    self.playingURL = nil
                    if !finished { self.failedURL = url }
                }
            }
        }
    }

    func stop() {
        player?.pause()
        player = nil
        playingURL = nil
        observation?.cancel()
    }
}
