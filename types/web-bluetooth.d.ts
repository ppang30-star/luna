// Web Bluetooth API TypeScript 타입 선언

interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice
  uuid: string
  isPrimary: boolean
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>
  getCharacteristics(characteristic?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>
}

interface BluetoothRemoteGATTCharacteristic {
  service: BluetoothRemoteGATTService
  uuid: string
  properties: BluetoothCharacteristicProperties
  value?: DataView
  getDescriptor(descriptor: string | number): Promise<BluetoothRemoteGATTDescriptor>
  getDescriptors(descriptor?: string | number): Promise<BluetoothRemoteGATTDescriptor[]>
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface BluetoothCharacteristicProperties {
  broadcast: boolean
  read: boolean
  writeWithoutResponse: boolean
  write: boolean
  notify: boolean
  indicate: boolean
  authenticatedSignedWrites: boolean
  reliableWrite: boolean
  writableAuxiliaries: boolean
}

interface BluetoothRemoteGATTDescriptor {
  characteristic: BluetoothRemoteGATTCharacteristic
  uuid: string
  value?: DataView
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[]
  optionalServices?: (string | number)[]
  acceptAllDevices?: boolean
}

interface BluetoothLEScanFilter {
  services?: (string | number)[]
  name?: string
  namePrefix?: string
  manufacturerData?: BluetoothManufacturerDataFilter[]
  serviceData?: BluetoothServiceDataFilter[]
}

interface BluetoothManufacturerDataFilter {
  companyIdentifier: number
  dataPrefix?: BufferSource
  mask?: BufferSource
}

interface BluetoothServiceDataFilter {
  service: string | number
  dataPrefix?: BufferSource
  mask?: BufferSource
}

interface Bluetooth {
  getAvailability(): Promise<boolean>
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface Navigator {
  bluetooth: Bluetooth
}
