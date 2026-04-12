// Gera ícones PNG simples para PWA usando apenas Node.js built-ins
import { createWriteStream } from 'fs'
import { deflateSync } from 'zlib'

function createPNG(size, bgColor, fgColor) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8]  = 8  // bit depth
  ihdr[9]  = 2  // color type RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr)

  // Image data: simple colored square with R$ text (approximated as colored block)
  const rawData = Buffer.alloc(size * (1 + size * 3))
  let offset = 0
  for (let y = 0; y < size; y++) {
    rawData[offset++] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      // Background color with rounded corners effect
      const margin = size * 0.1
      const inCorner = (x < margin || x > size - margin) && (y < margin || y > size - margin)

      // Center area for "R$" text approximation (lighter square)
      const cx = size / 2, cy = size / 2
      const inCenter = Math.abs(x - cx) < size * 0.35 && Math.abs(y - cy) < size * 0.22

      if (inCorner) {
        rawData[offset++] = bgColor[0]
        rawData[offset++] = bgColor[1]
        rawData[offset++] = bgColor[2]
      } else if (inCenter) {
        rawData[offset++] = fgColor[0]
        rawData[offset++] = fgColor[1]
        rawData[offset++] = fgColor[2]
      } else {
        rawData[offset++] = bgColor[0]
        rawData[offset++] = bgColor[1]
        rawData[offset++] = bgColor[2]
      }
    }
  }

  const compressed = deflateSync(rawData)
  const idatChunk  = makeChunk('IDAT', compressed)
  const iendChunk  = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crc   = crc32(Buffer.concat([typeB, data]))
  const crcB  = Buffer.alloc(4)
  crcB.writeInt32BE(crc)
  return Buffer.concat([len, typeB, data, crcB])
}

// Simple CRC32
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) {
    crc ^= b
    for (let k = 0; k < 8; k++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
  }
  return (crc ^ 0xFFFFFFFF) | 0
}

// bg: #1A1A2E, fg (text): #00C853
const BG = [0x1A, 0x1A, 0x2E]
const FG = [0x00, 0xC8, 0x53]

import { writeFileSync } from 'fs'
import { mkdirSync } from 'fs'

mkdirSync('./public', { recursive: true })

writeFileSync('./public/icon-192.png', createPNG(192, BG, FG))
writeFileSync('./public/icon-512.png', createPNG(512, BG, FG))

console.log('✅ Ícones gerados: public/icon-192.png e public/icon-512.png')
console.log('💡 Para ícones melhores, abra criar-icones.html no navegador')
