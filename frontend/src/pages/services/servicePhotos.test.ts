import {
  SERVICE_PHOTO_MAX_BYTES,
  dataUrlByteLength,
  isAllowedServicePhotoType,
  moveItem,
} from './servicePhotos'
import { computeResizedDimensions } from '../staff/masterPhoto'

describe('moveItem', () => {
  it('moves an item right and left', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns an unchanged copy for no-op or out-of-range moves', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(items, 0, 2)).toEqual(['a', 'b'])
    expect(moveItem(items, -1, 0)).toEqual(['a', 'b'])
    expect(moveItem(items, 0, 1)).not.toBe(items)
  })
})

describe('dataUrlByteLength', () => {
  it('computes decoded size, accounting for base64 padding', () => {
    expect(dataUrlByteLength(`data:image/jpeg;base64,${btoa('abc')}`)).toBe(3)
    expect(dataUrlByteLength(`data:image/jpeg;base64,${btoa('ab')}`)).toBe(2)
    expect(dataUrlByteLength(`data:image/jpeg;base64,${btoa('a')}`)).toBe(1)
  })

  it('tells a file just over the 1 MB limit from one exactly at it', () => {
    const at = btoa('x'.repeat(SERVICE_PHOTO_MAX_BYTES))
    const over = btoa('x'.repeat(SERVICE_PHOTO_MAX_BYTES + 1))
    expect(dataUrlByteLength(`data:image/jpeg;base64,${at}`)).toBe(SERVICE_PHOTO_MAX_BYTES)
    expect(dataUrlByteLength(`data:image/jpeg;base64,${over}`)).toBeGreaterThan(
      SERVICE_PHOTO_MAX_BYTES,
    )
  })
})

describe('service photo sizing and types', () => {
  it('scales the long side down to 1600 px keeping proportions', () => {
    expect(computeResizedDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(computeResizedDimensions(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(computeResizedDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('allows only JPEG, PNG and WebP', () => {
    expect(isAllowedServicePhotoType('image/jpeg')).toBe(true)
    expect(isAllowedServicePhotoType('image/png')).toBe(true)
    expect(isAllowedServicePhotoType('image/webp')).toBe(true)
    expect(isAllowedServicePhotoType('image/gif')).toBe(false)
  })
})
