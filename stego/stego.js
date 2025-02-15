#!/usr/bin/env bun

import { Jimp } from 'jimp'

// Convert a 32-bit integer into an array of 32 bits (little-endian)
function int32ToBits(num) {
  const bits = []
  for (let i = 0; i < 4; i++) {
    const byte = (num >> (8 * i)) & 0xff
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((byte >> bit) & 1)
    }
  }
  return bits
}

// Embed a message into the image's pixels (modifying only R, G, B channels)
function embedMessageInImage(image, message) {
  const messageBuffer = Buffer.from(message, 'utf8')
  const msgLength = messageBuffer.length
  const lengthBits = int32ToBits(msgLength)
  const messageBits = []
  for (const byte of messageBuffer) {
    for (let bit = 7; bit >= 0; bit--) {
      messageBits.push((byte >> bit) & 1)
    }
  }
  const totalBits = lengthBits.concat(messageBits)
  // Each pixel provides 3 bits (R, G, B)
  const capacity = image.bitmap.width * image.bitmap.height * 3
  if (totalBits.length > capacity) {
    console.error("Message too large for this image")
    process.exit(1)
  }
  let bitIndex = 0
  const data = image.bitmap.data
  // Process each pixel (each pixel is 4 bytes: R, G, B, A)
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
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

// Extract the hidden message from the image's pixels
function extractMessageFromImage(image) {
  const data = image.bitmap.data
  const bits = []
  // Read the LSBs from R, G, B channels of each pixel
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      bits.push(data[i + channel] & 1)
    }
  }
  if (bits.length < 32) {
    console.error("Not enough data in the image")
    process.exit(1)
  }
  // Extract message length from the first 32 bits (little-endian)
  let msgLength = 0
  for (let i = 0; i < 4; i++) {
    let byte = 0
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | bits[i * 8 + bit]
    }
    msgLength |= (byte << (8 * i))
  }
  const totalMsgBits = msgLength * 8
  if (bits.length < 32 + totalMsgBits) {
    console.error("Not enough data for the hidden message")
    process.exit(1)
  }
  const messageBytes = []
  for (let i = 0; i < msgLength; i++) {
    let byte = 0
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | bits[32 + i * 8 + bit]
    }
    messageBytes.push(byte)
  }
  return Buffer.from(messageBytes).toString('utf8')
}

async function writeImage(image, outputFile) {
  return new Promise((resolve, reject) => {
    image.write(outputFile, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function embed(inputFile, message, outputFile) {
  try {
    const image = await Jimp.read(inputFile)
    embedMessageInImage(image, message)
    await writeImage(image, outputFile)
    console.log("Message embedded into", outputFile)
  }
  catch (error) {
    console.error("Error processing image:", error)
    process.exit(1)
  }
}

async function extract(inputFile) {
  try {
    const image = await Jimp.read(inputFile)
    const message = extractMessageFromImage(image)
    console.log("Hidden message:", message)
  }
  catch (error) {
    console.error("Error processing image:", error)
    process.exit(1)
  }
}

// Command-line interface
const [ , , mode, ...args] = process.argv
if (mode === 'embed') {
  if (args.length < 3) {
    console.error('Usage: embed <inputImage> "message" <outputImage>')
    process.exit(1)
  }
  const [inputFile, message, outputFile] = args
  embed(inputFile, message, outputFile)
}
else if (mode === 'extract') {
  if (args.length < 1) {
    console.error('Usage: extract <inputImage>')
    process.exit(1)
  }
  const [inputFile] = args
  extract(inputFile)
}
else {
  console.error('Usage: <embed|extract> ...')
  process.exit(1)
}
