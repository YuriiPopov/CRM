import { describe, expect, it } from 'vitest'
import { computeResizedDimensions, isAllowedMasterPhotoType } from './masterPhoto'

describe('computeResizedDimensions', () => {
  it('leaves an image unchanged when both sides fit within maxDimension', () => {
    expect(computeResizedDimensions(300, 200, 400)).toEqual({ width: 300, height: 200 })
  })

  it('scales down a landscape image so the wider side matches maxDimension', () => {
    expect(computeResizedDimensions(800, 400, 400)).toEqual({ width: 400, height: 200 })
  })

  it('scales down a portrait image so the taller side matches maxDimension', () => {
    expect(computeResizedDimensions(400, 800, 400)).toEqual({ width: 200, height: 400 })
  })

  it('scales down a square image to exactly maxDimension', () => {
    expect(computeResizedDimensions(1000, 1000, 400)).toEqual({ width: 400, height: 400 })
  })

  it('never rounds a dimension down to zero', () => {
    const result = computeResizedDimensions(10000, 1, 400)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})

describe('isAllowedMasterPhotoType', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(isAllowedMasterPhotoType(type)).toBe(true)
  })

  it.each(['image/gif', 'application/pdf', 'text/plain'])('rejects %s', (type) => {
    expect(isAllowedMasterPhotoType(type)).toBe(false)
  })
})
