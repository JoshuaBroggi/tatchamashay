import CoreLocation
import Observation

/// Tracks where the player is standing.
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    private(set) var deviceLocation: CLLocation?
    private(set) var authorization: CLAuthorizationStatus = .notDetermined

    /// Testing aid: pretend the player is standing somewhere else ("sail" there) without walking.
    var testOverride: CLLocation?

    var location: CLLocation? { testOverride ?? deviceLocation }

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
    }

    func start() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        deviceLocation = locations.last
    }
}
