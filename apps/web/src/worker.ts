interface ApiBinding {
  fetch(request: Request): Promise<Response>
}

interface Environment {
  readonly API: ApiBinding
}

export default {
  fetch(request: Request, env: Environment): Promise<Response> {
    return env.API.fetch(request)
  },
}
