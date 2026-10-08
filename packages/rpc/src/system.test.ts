import { expect, test } from 'vitest'
import { SystemStatus } from './system.ts'

test('SystemStatus decodes the public response shape', () => {
  expect(SystemStatus.make({ message: 'API connected' })).toEqual({
    message: 'API connected',
  })
})
