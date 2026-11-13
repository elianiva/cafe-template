import { expect, test } from 'vitest'
import worker from './worker.ts'

const request = new Request('https://template.test/api/rpc', {
  method: 'POST',
  body: '{"method":"ping"}',
})

test('the website Worker forwards API requests through the service binding', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker', { status: 202 }))
      },
    },
  })

  expect(forwarded).toHaveLength(1)
  expect(forwarded[0]?.url).toBe('https://template.test/api/rpc')
  expect(response.status).toBe(202)
  expect(await response.text()).toBe('from the API Worker')
})

test('the website Worker refuses a request over the per-IP limit', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker'))
      },
    },
    RATE_LIMIT_API: {
      limit: () => Promise.resolve({ success: false }),
    },
  })

  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('60')
  expect(forwarded).toEqual([])
})

test('the rate limiter fails open', async () => {
  const forwarded: Array<Request> = []

  const response = await worker.fetch(request, {
    API: {
      fetch(input) {
        forwarded.push(input)
        return Promise.resolve(new Response('from the API Worker'))
      },
    },
    RATE_LIMIT_API: {
      limit: () => Promise.reject(new Error('The limiter is down.')),
    },
  })

  expect(response.status).toBe(200)
  expect(forwarded).toHaveLength(1)
})
