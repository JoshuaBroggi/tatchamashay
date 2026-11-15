# Tatchamashay

Tatchamashay is an iPhone treasure-hunting game. Parents create beasts and choose reviewed locations;
children explore the map, find treasures in any order and keep them in My Chest.

## Build and test

Requires macOS, Xcode 27 and xcodegen (`brew install xcodegen`).

```sh
ios/scripts/build.sh build
ios/scripts/build.sh test
```

The scripts generate the Xcode project. See [iPhone developer guidance](ios/AGENTS.md),
[product rules](ios/PLAN.md), [release plan](ios/SHIP_PLAN.md) and [asset pipeline](ios/Assets/README.md).

## One supported game

`ios/` is the source of truth for gameplay and content. New characters and features must work in the
iPhone app. The asset manifest, Swift catalog and record types define the content contract; their tests
check consistency. Historical browser characters are not automatically available or approved for iPhone.

The old browser game and PartyKit server are retired in [archive/browser](archive/browser/README.md).
Their standard launch/build/deployment commands are disabled. There is no browser gameplay release or
parallel feature-support track. Git history and the archive preserve the old work.

Any future web tool is for administration only and must use the same canonical content and validation
rules. No separate web admin application is included today.

Existing hosted deployments require separate shutdown in their hosting accounts; moving source does
not remove an already published site or running PartyKit service.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements and [LICENSE](LICENSE) for licensing.
