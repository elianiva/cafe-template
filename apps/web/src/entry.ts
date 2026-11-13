import { Layer } from 'effect'
import { Runtime } from 'foldkit'
import { init, Message, Model, update, view } from './app/main.ts'
import { ApiRpc } from './platform/rpc.ts'
import { reportCrash, reportSlow, startSentry, tracerLayer } from './platform/sentry.ts'
import './styles.css'

// First, so errors while the app boots are caught too.
startSentry()

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  resources: Layer.mergeAll(ApiRpc.layer, tracerLayer),
  container: document.getElementById('root'),
  crash: { report: reportCrash },
  slow: { show: 'Always', onSlow: reportSlow },
  devTools: { Message },
})

Runtime.run(application)
