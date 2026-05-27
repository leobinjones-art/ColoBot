// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ColoMindWatch",
    platforms: [
        .watchOS(.v10)
    ],
    products: [
        .library(
            name: "ColoMindWatch",
            targets: ["ColoMindWatch"]
        ),
    ],
    targets: [
        .target(
            name: "ColoMindWatch",
            dependencies: []
        ),
    ]
)