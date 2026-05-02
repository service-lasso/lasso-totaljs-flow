# lasso-totaljs-flow

Service Lasso package repo for the Total.js Flow app.

The release pipeline packages the app with production `npm` dependencies already installed, publishes OS-specific archives, and publishes the matching `service.json` manifest.

## Service Contract

- Service id: `totaljs-flow`
- Runtime dependency: `@node`
- Service dependency: `totaljs-messageservice`
- Default port: `8111`
- Healthcheck: `GET /` must return `200`
- Global environment exported to dependants:
  - `FLOW_HOST_URL=http://127.0.0.1:${SERVICE_PORT}`
  - `FLOW_PORT=${SERVICE_PORT}`
- Environment consumed from `totaljs-messageservice`:
  - `MESSAGESERVICE_URL`
  - `MESSAGESERVICE_PORT`

## Release Assets

Each release contains:

- `lasso-totaljs-flow-10.0.0-win32.zip`
- `lasso-totaljs-flow-10.0.0-linux.tar.gz`
- `lasso-totaljs-flow-10.0.0-darwin.tar.gz`
- `service.json`
- `SHA256SUMS.txt`

## Local Verification

```powershell
npm test
```

The verification packages the current OS, extracts the archive, starts the packaged service through the wrapper with message-service env values, and checks the HTTP health status.
