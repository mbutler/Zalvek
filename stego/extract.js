#!/usr/bin/env bun

import { Jimp } from "jimp"

// Extracts the embedded message from an image
function extractMessageFromImage(image) {
  const data = image.bitmap.data
  const bits = []

  // Read LSBs from R, G, B channels of each pixel
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      bits.push(data[i + j] & 1)
    }
  }

  if (bits.length < 32) {
    console.error("Error: Not enough data in the image.")
    process.exit(1)
  }

  // Extract message length (first 32 bits)
  let msgLength = 0
  for (let i = 0; i < 32; i++) {
    msgLength = (msgLength << 1) | bits[i]
  }

  const totalMsgBits = msgLength * 8
  if (bits.length < 32 + totalMsgBits) {
    console.error("Error: Not enough data for the hidden message.")
    process.exit(1)
  }

  // Extract message bytes
  const messageBytes = []
  for (let i = 0; i < msgLength; i++) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[32 + i * 8 + j]
    }
    messageBytes.push(byte)
  }

  return Buffer.from(messageBytes).toString("utf8")
}

// Extract message from the PNG file and log it
async function extractMessage(imageFile) {
  try {
    console.log(`🔍 Extracting message from ${imageFile}...`)
    const image = await Jimp.read(imageFile)
    const extracted = extractMessageFromImage(image)

    console.log("📜 Extracted Message:")
    console.log(extracted)
  } catch (error) {
    console.error("Error processing image:", error)
    process.exit(1)
  }
}

// Command-line interface
const [ , , imageFile] = process.argv
if (!imageFile) {
  console.error("Usage: extract.js <stegoImage.png>")
  process.exit(1)
}

extractMessage(imageFile)
