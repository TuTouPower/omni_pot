#!/usr/bin/env swift

import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: macos_ocr <image_path> [language_code]\n", stderr)
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let language = CommandLine.arguments.count >= 3 ? CommandLine.arguments[2] : nil

guard let imageURL = URL(string: "file://\(imagePath)"),
      let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
    fputs("Error: Cannot load image at \(imagePath)\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

if let lang = language, !lang.isEmpty {
    request.recognitionLanguages = [lang]
}

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
    try handler.perform([request])
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    exit(1)
}

guard let observations = request.results else {
    exit(0)
}

let text = observations.compactMap { observation in
    observation.topCandidates(1).first?.string
}.joined(separator: "\n")

print(text)
