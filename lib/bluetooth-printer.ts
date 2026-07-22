/**
 * SEWOO LK-P25 블루투스 영수증 프린터 직접 연결 모듈
 * Web Bluetooth API를 사용하여 ESC/POS 명령어로 직접 인쇄
 */

// ESC/POS 명령어 상수
const ESC = 0x1B
const GS = 0x1D
const LF = 0x0A

// ESC/POS 명령어 생성 함수들
export const ESCPOS = {
  // 프린터 초기화
  INIT: new Uint8Array([ESC, 0x40]),
  
  // 텍스트 정렬
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  
  // 텍스트 스타일
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: new Uint8Array([GS, 0x21, 0x10]),
  DOUBLE_WIDTH_ON: new Uint8Array([GS, 0x21, 0x20]),
  DOUBLE_SIZE_ON: new Uint8Array([GS, 0x21, 0x30]),
  NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),
  
  // 줄바꿈
  LINE_FEED: new Uint8Array([LF]),
  
  // 용지 자르기 (부분 자르기)
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x41, 0x03]),
  
  // 용지 이동 (n줄)
  feedLines: (n: number) => new Uint8Array([ESC, 0x64, n]),
}

// 텍스트를 바이트 배열로 변환 (UTF-8 인코딩)
function textToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(text)
}

// 여러 Uint8Array를 하나로 합치기
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

// 58mm 프린터 기준 한 줄 최대 글자 수 (약 32자)
const LINE_WIDTH = 32

// 텍스트를 지정된 폭에 맞게 포맷팅
function formatLine(left: string, right: string, width: number = LINE_WIDTH): string {
  const leftLen = [...left].length
  const rightLen = [...right].length
  const spaces = Math.max(1, width - leftLen - rightLen)
  return left + ' '.repeat(spaces) + right
}

// 중앙 정렬 텍스트
function centerText(text: string, width: number = LINE_WIDTH): string {
  const textLen = [...text].length
  const padding = Math.max(0, Math.floor((width - textLen) / 2))
  return ' '.repeat(padding) + text
}

// 구분선 생성
function dashedLine(width: number = LINE_WIDTH): string {
  return '-'.repeat(width)
}

function solidLine(width: number = LINE_WIDTH): string {
  return '='.repeat(width)
}

// 블루투스 프린터 연결 상태
let bluetoothDevice: BluetoothDevice | null = null
let printerCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

// SEWOO LK-P25 프린터 서비스 및 특성 UUID
// 일반적인 SPP(Serial Port Profile) 에뮬레이션 UUID
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

// 대체 UUID (일부 프린터에서 사용)
const ALT_SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455'
const ALT_CHARACTERISTIC_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3'

// 블루투스 프린터 연결
export async function connectBluetoothPrinter(): Promise<boolean> {
  try {
    // Web Bluetooth API 지원 확인
    if (!navigator.bluetooth) {
      console.error('[v0] Web Bluetooth API is not supported in this browser')
      throw new Error('이 브라우저는 블루투스를 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.')
    }

    // 블루투스 장치 검색 및 선택
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      // SEWOO 프린터 또는 일반 프린터 필터
      filters: [
        { namePrefix: 'LK-P' },
        { namePrefix: 'SEWOO' },
        { namePrefix: 'SPP' },
        { services: [PRINTER_SERVICE_UUID] },
        { services: [ALT_SERVICE_UUID] },
      ],
      optionalServices: [PRINTER_SERVICE_UUID, ALT_SERVICE_UUID],
    })

    if (!bluetoothDevice) {
      throw new Error('프린터를 선택하지 않았습니다.')
    }

    console.log('[v0] Bluetooth device selected:', bluetoothDevice.name)

    // GATT 서버 연결
    const server = await bluetoothDevice.gatt?.connect()
    if (!server) {
      throw new Error('프린터에 연결할 수 없습니다.')
    }

    console.log('[v0] GATT server connected')

    // 프린터 서비스 찾기 (여러 UUID 시도)
    let service: BluetoothRemoteGATTService | null = null
    let characteristicUUID = PRINTER_CHARACTERISTIC_UUID

    try {
      service = await server.getPrimaryService(PRINTER_SERVICE_UUID)
      console.log('[v0] Primary service found with standard UUID')
    } catch {
      try {
        service = await server.getPrimaryService(ALT_SERVICE_UUID)
        characteristicUUID = ALT_CHARACTERISTIC_UUID
        console.log('[v0] Primary service found with alternative UUID')
      } catch {
        throw new Error('프린터 서비스를 찾을 수 없습니다.')
      }
    }

    // 특성(Characteristic) 가져오기
    printerCharacteristic = await service.getCharacteristic(characteristicUUID)
    console.log('[v0] Printer characteristic found')

    return true
  } catch (error) {
    console.error('[v0] Bluetooth connection error:', error)
    bluetoothDevice = null
    printerCharacteristic = null
    throw error
  }
}

// 블루투스 프린터 연결 해제
export function disconnectBluetoothPrinter(): void {
  if (bluetoothDevice?.gatt?.connected) {
    bluetoothDevice.gatt.disconnect()
  }
  bluetoothDevice = null
  printerCharacteristic = null
  console.log('[v0] Bluetooth printer disconnected')
}

// 프린터 연결 상태 확인
export function isPrinterConnected(): boolean {
  return bluetoothDevice?.gatt?.connected === true && printerCharacteristic !== null
}

// 데이터를 프린터로 전송 (청크 단위로 분할)
async function sendToPrinter(data: Uint8Array): Promise<void> {
  if (!printerCharacteristic) {
    throw new Error('프린터가 연결되지 않았습니다.')
  }

  // BLE 최대 패킷 크기 (일반적으로 20바이트, 일부 기기는 512바이트까지)
  const CHUNK_SIZE = 20

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, Math.min(i + CHUNK_SIZE, data.length))
    await printerCharacteristic.writeValue(chunk)
    // 프린터가 데이터를 처리할 시간을 주기 위한 약간의 딜레이
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

// 영수증 데이터 인터페이스
interface SelectedModifier {
  modifierId: string
  modifierGroupName: string
  selectedOption: string
  selectedOptionLabel: string
}

export interface ReceiptData {
  header: string
  billNumber: string
  tableNumber: string
  date: string
  time: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    subtotal: number
    selectedModifiers?: SelectedModifier[]
  }>
  subtotal: number
  vat?: { label: string; amount: number }
  discount?: { label: string; amount: number }
  cardSurcharge?: { label: string; amount: number }
  paymentMethod: 'cash' | 'card'
  paymentLabel: string
  grandTotal: number
  grandTotalLabel: string
  footer: string
  thankYou: string
  currencySymbol?: string
}

// 금액 포맷팅
function formatAmount(amount: number, symbol?: string): string {
  const formatted = amount.toLocaleString('ko-KR')
  return symbol ? `${formatted}${symbol}` : formatted
}

// 영수증 인쇄 (ESC/POS 다이렉트)
export async function printReceiptDirect(receipt: ReceiptData): Promise<void> {
  if (!isPrinterConnected()) {
    // 연결되어 있지 않으면 먼저 연결 시도
    await connectBluetoothPrinter()
  }

  const symbol = receipt.currencySymbol || ''
  
  // 영수증 데이터 구성
  const lines: Uint8Array[] = [
    // 프린터 초기화
    ESCPOS.INIT,
    
    // 헤더 (중앙 정렬, 굵게)
    ESCPOS.ALIGN_CENTER,
    ESCPOS.BOLD_ON,
    textToBytes(`[${receipt.header}]\n`),
    ESCPOS.BOLD_OFF,
    
    // 구분선
    ESCPOS.ALIGN_LEFT,
    textToBytes(dashedLine() + '\n'),
    
    // 영수증 정보
    textToBytes(formatLine('Bill No:', `#${receipt.billNumber}`) + '\n'),
    textToBytes(formatLine('Table:', receipt.tableNumber) + '\n'),
    textToBytes(formatLine('Date:', receipt.date) + '\n'),
    textToBytes(formatLine('Time:', receipt.time) + '\n'),
    
    // 굵은 구분선
    textToBytes(solidLine() + '\n'),
  ]

  // 주문 항목들
  for (const item of receipt.items) {
    // 메뉴명 (긴 이름은 잘라서 표시)
    const itemName = item.name.length > LINE_WIDTH - 2 
      ? item.name.substring(0, LINE_WIDTH - 5) + '...'
      : item.name
    
    lines.push(
      ESCPOS.BOLD_ON,
      textToBytes(itemName + '\n'),
      ESCPOS.BOLD_OFF,
      textToBytes(formatLine(
        `  ${item.quantity} x ${formatAmount(item.unitPrice, symbol)}`,
        formatAmount(item.subtotal, symbol)
      ) + '\n')
    )
    
    // Add modifiers if present
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      for (const mod of item.selectedModifiers) {
        lines.push(
          textToBytes(`    [${mod.modifierGroupName}] ${mod.selectedOptionLabel}\n`)
        )
      }
    }
  }

  // 구분선
  lines.push(textToBytes(dashedLine() + '\n'))

  // 소계
  lines.push(textToBytes(formatLine('Subtotal:', formatAmount(receipt.subtotal, symbol)) + '\n'))

  // 부가세
  if (receipt.vat && receipt.vat.amount > 0) {
    lines.push(textToBytes(formatLine(receipt.vat.label + ':', formatAmount(receipt.vat.amount, symbol)) + '\n'))
  }

  // 할인
  if (receipt.discount && receipt.discount.amount > 0) {
    lines.push(textToBytes(formatLine(receipt.discount.label + ':', '-' + formatAmount(receipt.discount.amount, symbol)) + '\n'))
  }

  // 카드 수수료
  if (receipt.cardSurcharge && receipt.cardSurcharge.amount > 0) {
    lines.push(textToBytes(formatLine(receipt.cardSurcharge.label + ':', formatAmount(receipt.cardSurcharge.amount, symbol)) + '\n'))
  }

  // 구분선
  lines.push(textToBytes(dashedLine() + '\n'))

  // 결제 방법 (중앙 정렬)
  lines.push(
    ESCPOS.ALIGN_CENTER,
    textToBytes(`[ ${receipt.paymentLabel} ]\n`),
    ESCPOS.ALIGN_LEFT
  )

  // 굵은 구분선
  lines.push(textToBytes(solidLine() + '\n'))

  // 총 합계 (굵게, 크게)
  lines.push(
    ESCPOS.BOLD_ON,
    ESCPOS.DOUBLE_SIZE_ON,
    ESCPOS.ALIGN_CENTER,
    textToBytes(formatAmount(receipt.grandTotal, symbol) + '\n'),
    ESCPOS.NORMAL_SIZE,
    ESCPOS.BOLD_OFF,
    ESCPOS.ALIGN_LEFT
  )

  // 굵은 구분선
  lines.push(textToBytes(solidLine() + '\n'))

  // 푸터
  lines.push(
    ESCPOS.ALIGN_CENTER,
    textToBytes(receipt.footer + '\n'),
    textToBytes(receipt.thankYou + '\n'),
    ESCPOS.ALIGN_LEFT
  )

  // 여백 및 용지 자르기
  lines.push(
    ESCPOS.feedLines(4),
    ESCPOS.CUT_PAPER
  )

  // 모든 데이터 합치기
  const fullData = concatBytes(...lines)

  // 프린터로 전송
  await sendToPrinter(fullData)
  
  console.log('[v0] Receipt printed successfully via Bluetooth')
}

// 연결된 프린터 이름 가져오기
export function getConnectedPrinterName(): string | null {
  return bluetoothDevice?.name || null
}
