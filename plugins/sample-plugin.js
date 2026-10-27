export default function registerSamplePlugin(appContext = {}) {
  return {
    name: 'sample-plugin',
    status: 'loaded',
    datastore: appContext.datastore ?? null,
    boot: () => ({
      plugin: 'sample-plugin',
      ready: true,
    }),
  };
}
