// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NexusMindWatch",
    platforms: [
        .watchOS(.v10)
    ],
    products: [
        .library(
            name: "NexusMindWatch",
            targets: ["NexusMindWatch"]
        ),
    ],
    targets: [
        .target(
            name: "NexusMindWatch",
            dependencies: []
        ),
    ]
)