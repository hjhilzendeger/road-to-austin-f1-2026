// Explicit source identity for a substitute absent from the original roster.
// Never map a substitute's result onto the driver whose seat they occupy.
const sourceDrivers = {
  ryo_hirakawa: { id: 'HIR', name: 'Ryo Hirakawa', dob: '1994-03-07' }
};

export function resolveDriverId(driver, drivers, round) {
  const known = Object.hasOwn(sourceDrivers, driver?.driverId)
    ? sourceDrivers[driver.driverId] : undefined;
  const id = known?.id ?? driver?.code;
  const canonical = drivers.find(d => d.id === id);
  const context = `driver ${driver?.code ?? '(missing code)'} (${driver?.driverId ?? 'missing driverId'}) at round ${round}`;
  if (!canonical) throw new Error(`Unknown ${context}`);
  // HIR requires the stable source ID as well as matching identity metadata.
  if (id === 'HIR' && (!known || driver.code !== known.id ||
      `${driver.givenName} ${driver.familyName}` !== known.name ||
      driver.dateOfBirth !== known.dob || canonical.name !== known.name ||
      canonical.dob !== known.dob)) {
    throw new Error(`Conflicting identity for ${context}`);
  }
  return id;
}
