import { Runtime } from 'foldkit'
import { init, Message, Model, update, view } from './app/main.ts'
import { ApiRpc } from './platform/rpc.ts'
import './styles.css'

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  resources: ApiRpc.layer,
  container: document.getElementById('root'),
  // The default crash view renders. Replace the reporter with Sentry or another
  // service when you add one; until then the console keeps the cause.
  crash: {
    report: ({ error }) => console.error('The application crashed', error),
  },
  devTools: { Message },
})

Runtime.run(application)
