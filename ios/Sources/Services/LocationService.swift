import CoreLocation
import Observation

/// Tracks where the phone is. Location stays on the phone; nothing here is sent anywhere.
@MainActor
@Observable
final class LocationService {
    private(set) var latestFix: LocationFix?
    private(set) var isDenied = false
    /// The system pauses updates while the phone stays put. The last fix is still where we are.
    private(set) var isStationary = false

    /// The fix to judge right now. While the system reports the phone hasn't moved, the last fix
    /// counts as current; its accuracy is still checked.
    func currentFix(now: Date) -> LocationFix? {
        guard var fix = latestFix else { return nil }
        if isStationary { fix.timestamp = max(fix.timestamp, now) }
        return fix
    }

    private var task: Task<Void, Never>?
    private var session: CLServiceSession?

    func start() {
        guard task == nil else { return }
        session = CLServiceSession(authorization: .whenInUse)
        task = Task { [weak self] in
            do {
                for try await update in CLLocationUpdate.liveUpdates(.fitness) {
                    guard let self else { return }
                    self.isDenied = update.authorizationDenied || update.authorizationDeniedGlobally
                    self.isStationary = update.stationary
                    if let location = update.location {
                        self.latestFix = LocationFix(location)
                    }
                }
            } catch {
                // The stream ended; the hunt falls back to the foggy-map message and We found it.
            }
        }
    }
}

extension LocationFix {
    init(_ location: CLLocation) {
        self.init(
            coordinate: Coordinate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude),
            horizontalAccuracy: location.horizontalAccuracy,
            timestamp: location.timestamp
        )
    }
}

extension Coordinate {
    init(_ c: CLLocationCoordinate2D) { self.init(latitude: c.latitude, longitude: c.longitude) }
    var clCoordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}
