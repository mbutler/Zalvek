#!/usr/bin/env bun

import { Jimp } from "jimp"

// Convert a 32-bit integer into an array of 32 bits (BIG-ENDIAN)
function int32ToBits(num) {
  const bits = []
  for (let i = 3; i >= 0; i--) { // Store in BIG-ENDIAN order
    const byte = (num >> (8 * i)) & 0xff // Extract byte
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((byte >> bit) & 1) // Extract each bit
    }
  }
  return bits
}

// Embed a message into the image's pixels (modifying only R, G, B channels)
function embedMessageInImage(image, message) {
  const messageBuffer = Buffer.from(message, "utf8")
  const msgLength = messageBuffer.length

  // Store length as a 32-bit BIG-ENDIAN integer
  const lengthBits = int32ToBits(msgLength)

  const messageBits = []
  for (const byte of messageBuffer) {
    for (let bit = 7; bit >= 0; bit--) {
      messageBits.push((byte >> bit) & 1)
    }
  }

  const totalBits = lengthBits.concat(messageBits)
  const capacity = image.bitmap.width * image.bitmap.height * 3 // 3 bits per pixel

  if (totalBits.length > capacity) {
    console.error("Error: Message too large for this image")
    process.exit(1)
  }

  let bitIndex = 0
  const data = image.bitmap.data

  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) { // Modify R, G, B only
      if (bitIndex < totalBits.length) {
        data[i + channel] = (data[i + channel] & 0xfe) | totalBits[bitIndex]
        bitIndex++
      } else {
        break
      }
    }
    if (bitIndex >= totalBits.length) break
  }

  return image
}

// Write the modified image to a file
async function writeImage(image, outputFile) {
  return new Promise((resolve, reject) => {
    image.write(outputFile, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// Embed message into an image and save the output
async function embed(inputFile, message, outputFile) {
  try {
    console.log(`📥 Loading input image: ${inputFile}...`)
    const image = await Jimp.read(inputFile)

    console.log("📝 Embedding message...")
    embedMessageInImage(image, message)

    console.log(`💾 Saving output image: ${outputFile}...`)
    await writeImage(image, outputFile)

    console.log("✅ Message successfully embedded! Fully compatible with generator.js.")
  } catch (error) {
    console.error("Error processing image:", error)
    process.exit(1)
  }
}

// Command-line interface
const [ , , inputFile, message, outputFile] = process.argv
if (!inputFile || !message || !outputFile) {
  console.error("Usage: embed.js <input.png> \"<message>\" <output.png>")
  process.exit(1)
}

embed(inputFile, message, outputFile)
