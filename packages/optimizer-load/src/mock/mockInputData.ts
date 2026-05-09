import type { InputData, Order, Stop } from "../types.js";

/**
 * Mock data inspirado en datos reales de DDI:
 *   - Carga 11764300 (08.05.2026, ruta DR0027), repartidor FRAN ROMERO,
 *     vehículo V235045 (8 palets).
 *   - 14 clientes únicos en la zona Sant Julià de Vilatorta / Calldetenes /
 *     Folgueroles (extraídos de la Hoja Ruta).
 *   - Items reales tomados de la Hoja Carga, distribuidos por cliente con
 *     una mezcla coherente: barriles, cajas retornables, alimentación,
 *     limpieza y licores.
 */

const stops: Stop[] = [
  {
    id: "stop-01",
    clientId: "9100627695",
    clientName: "BAR PAVELLO ST JULIA VILATORTA",
    address: "Avinguda Sant Llorenç s/n, Sant Julià de Vilatorta",
    zone: "Sant Julià",
    route: "DR0027",
    timeWindow: { from: "08:30", to: "11:00" },
    historicalConfidence: 0.9,
    orders: ["order-01"],
  },
  {
    id: "stop-02",
    clientId: "9100727035",
    clientName: "BAR EL TUPÍ",
    address: "Avinguda Nostra Senyora de Mont, Sant Julià de Vilatorta",
    zone: "Sant Julià",
    route: "DR0027",
    historicalConfidence: 0.85,
    orders: ["order-02"],
  },
  {
    id: "stop-03",
    clientId: "9100058180",
    clientName: "MAS L' ALBAREDA",
    address: "Avinguda de Sant Llorenç 68, Sant Julià de Vilatorta",
    zone: "Sant Julià",
    route: "DR0027",
    orders: ["order-03"],
  },
  {
    id: "stop-04",
    clientId: "9100129392",
    clientName: "BAR NURIA ST.JULIA VILATORTA",
    address: "Carrer Núria 27, Sant Julià de Vilatorta",
    zone: "Sant Julià",
    route: "DR0027",
    orders: ["order-04"],
  },
  {
    id: "stop-05",
    clientId: "9100056827",
    clientName: "CAL TEIXIDOR",
    address: "Carrer de Puig-l'agulla s/n, Sant Julià de Vilatorta",
    zone: "Sant Julià",
    route: "DR0027",
    orders: ["order-05"],
  },
  {
    id: "stop-06",
    clientId: "9100057776",
    clientName: "RESTAURANT EL ROSER",
    address: "Avinguda Pau Casals 22, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-06"],
  },
  {
    id: "stop-07",
    clientId: "9100220279",
    clientName: "CELLER CALLDETENES",
    address: "Carrer Gran 1, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-07"],
  },
  {
    id: "stop-08",
    clientId: "9100145307",
    clientName: "SUKIPA",
    address: "Carrer Gran 9, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-08"],
  },
  {
    id: "stop-09",
    clientId: "9100572141",
    clientName: "BAR DE LA BENZINERA",
    address: "Carretera N-141 D s/n, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-09"],
  },
  {
    id: "stop-10",
    clientId: "9100742290",
    clientName: "BAR DE LA BENZINERA HIGIENE",
    address: "Carretera N-141 D s/n, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-10"],
  },
  {
    id: "stop-11",
    clientId: "9100667648",
    clientName: "CA LA NENA",
    address: "Carrer Gran 20, Calldetenes",
    zone: "Calldetenes",
    route: "DR0027",
    orders: ["order-11"],
  },
  {
    id: "stop-12",
    clientId: "9100159144",
    clientName: "BAR KARNAK",
    address: "Carrer Major 12, Folgueroles",
    zone: "Folgueroles",
    route: "DR0027",
    orders: ["order-12"],
  },
  {
    id: "stop-13",
    clientId: "9100058035",
    clientName: "L'ESPAI RESTAURANT",
    address: "Carrer Rec d'Acumulada 9, Folgueroles",
    zone: "Folgueroles",
    route: "DR0027",
    orders: ["order-13"],
  },
  {
    id: "stop-14",
    clientId: "9100385693",
    clientName: "LA COCA DE FOLGUEROLES",
    address: "Carrer Camí Vell de Vic 16, Folgueroles",
    zone: "Folgueroles",
    route: "DR0027",
    orders: ["order-14"],
  },
];

const orders: Order[] = [
  // BAR PAVELLO — bar grande, mezcla de cervezas y un barril
  {
    id: "order-01",
    stopId: "stop-01",
    paymentType: "CONTADO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 12,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "ED30",
        name: "ESTRELLA DAMM BARRIL 30",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AA10A1",
      },
      {
        productId: "VE11",
        name: "AGUA VERI 1/1 VIDRIO RET.",
        quantity: 3,
        unit: "Caja",
        warehouseLocation: "AA11A1",
      },
      {
        productId: "0LM0166",
        name: "GC SERVILLETAS 1C KANGUR NEGRAS 40x40 50U",
        quantity: 2,
        unit: "Unidad",
        warehouseLocation: "ZCG",
      },
    ],
  },
  // BAR EL TUPÍ — bar de barrio, cervezas variadas y refrescos
  {
    id: "order-02",
    stopId: "stop-02",
    paymentType: "CONTADO",
    items: [
      {
        productId: "VO13",
        name: "VOLL-DAMM 1/3 RET.",
        quantity: 4,
        unit: "Caja",
        warehouseLocation: "AA07A1",
      },
      {
        productId: "FD13",
        name: "FREE DAMM 1/3 RET.",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "AA06A1",
      },
      {
        productId: "0RF0287",
        name: "/-COCA COLA VR237 24U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "AC06A1",
      },
      {
        productId: "TU20",
        name: "TURIA BARRIL 20L.",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AC03A2",
      },
    ],
  },
  // MAS L'ALBAREDA — restaurante de eventos, pedido grande con vinos
  {
    id: "order-03",
    stopId: "stop-03",
    paymentType: "CREDITO",
    items: [
      {
        productId: "ED15LN",
        name: "ESTRELLA DAMM 1/5 LN",
        quantity: 6,
        unit: "Caja",
        warehouseLocation: "AA08A1",
      },
      {
        productId: "0AG0021",
        name: "FONT D.OR MAXIMUM NATURAL 1L RET 12U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "AC07A3",
      },
      {
        productId: "0VE0465",
        name: "SOLAR DE ZUNIL BLANCO 75CL 6U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "EA08A1",
      },
      {
        productId: "0LI0044",
        name: "MAGNO BRANDY 70CL",
        quantity: 4,
        unit: "Botella",
        warehouseLocation: "ZCG",
      },
      {
        productId: "UE902",
        name: "COPA GRANDE ED",
        quantity: 24,
        unit: "Unidad",
        warehouseLocation: "FA02A2",
      },
    ],
  },
  // BAR NURIA — pedido medio, retornables clásicos
  {
    id: "order-04",
    stopId: "stop-04",
    paymentType: "CREDITO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 18,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "DL13",
        name: "DAMM LEMON 1/3 RET",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "AA02A1",
      },
      {
        productId: "ID20",
        name: "INEDIT DAMM BARRIL 20L",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AC01A1",
      },
      {
        productId: "TB8",
        name: "BOTELLAS CARBONICO #8 KILOS",
        quantity: 1,
        unit: "Tubo",
        warehouseLocation: "AC01A1",
      },
    ],
  },
  // CAL TEIXIDOR — restaurante grande, mezcla diversa
  {
    id: "order-05",
    stopId: "stop-05",
    paymentType: "CREDITO",
    items: [
      {
        productId: "FDT13",
        name: "FREE DAMM TOSTADA 1/3 RET. PP",
        quantity: 3,
        unit: "Caja",
        warehouseLocation: "AA04A1",
      },
      {
        productId: "DL30",
        name: "DAMM LEMON BARRIL 30",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AC04A1",
      },
      {
        productId: "0AM4905",
        name: "LAYS SAL 20U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "A0DISTRIDA",
      },
      {
        productId: "0LM0099",
        name: "BALNIC LAVAVAJILLAS MAQ. AGUAS DURAS 6KG",
        quantity: 2,
        unit: "Unidad",
        warehouseLocation: "ZCG",
      },
    ],
  },
  // RESTAURANT EL ROSER — clásico de menú, pedido equilibrado
  {
    id: "order-06",
    stopId: "stop-06",
    paymentType: "CONTADO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 8,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "VE32SP",
        name: "AGUA VERI 1,5L PET CAJA 12U.",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "EB02A1",
      },
      {
        productId: "0AM0362",
        name: "REDONDO COCTEL DE ACEITUNAS 9 KG.",
        quantity: 1,
        unit: "Unidad",
        warehouseLocation: "ZCG",
      },
    ],
  },
  // CELLER CALLDETENES — bodega, mucho vino y licores
  {
    id: "order-07",
    stopId: "stop-07",
    paymentType: "CREDITO",
    items: [
      {
        productId: "0LI0185",
        name: "RATAFIA RUSSET 70CL",
        quantity: 4,
        unit: "Botella",
        warehouseLocation: "ZCG",
      },
      {
        productId: "0LI0172",
        name: "SEAGRAM'S GIN EXTRA DRY 70CL",
        quantity: 2,
        unit: "Botella",
        warehouseLocation: "ZCG",
      },
      {
        productId: "EC13",
        name: "DAURA DAMM 1/3 RET.",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "BA05A1",
      },
    ],
  },
  // SUKIPA — restaurante asiático
  {
    id: "order-08",
    stopId: "stop-08",
    paymentType: "CONTADO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 10,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "VE12SP",
        name: "AGUA VERI 1/2 PET CAJA 24U. T.TH",
        quantity: 3,
        unit: "Caja",
        warehouseLocation: "EB03A1",
      },
      {
        productId: "0AG0011",
        name: "VICHY CATALAN GAS 1/2 RET 20U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "AC07A1",
      },
      {
        productId: "0LT0032",
        name: "CACAOLAT VIDRIO 20CL RET 30U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "AC04A3",
      },
    ],
  },
  // BAR DE LA BENZINERA — gasolinera, servicio grande
  {
    id: "order-09",
    stopId: "stop-09",
    paymentType: "CREDITO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 20,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "ED30",
        name: "ESTRELLA DAMM BARRIL 30",
        quantity: 2,
        unit: "Barril",
        warehouseLocation: "AA10A1",
      },
      {
        productId: "0RF0019",
        name: "/-COCA COLA LATA 33CL 24U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "CA04A2",
      },
      {
        productId: "0AM0783",
        name: "LOTUS BISCOFF 300U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "FA05A2",
      },
    ],
  },
  // BAR DE LA BENZINERA HIGIENE — pedido pequeño solo de limpieza
  {
    id: "order-10",
    stopId: "stop-10",
    paymentType: "CREDITO",
    items: [
      {
        productId: "0LM0184",
        name: "SECAMANOS GC 2C.ADD AZUL 106M 6U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "ZCG",
      },
      {
        productId: "0LM0038",
        name: "FLOQUET LEJIA 5L 3U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "ZCG",
      },
    ],
  },
  // CA LA NENA — restaurante familiar
  {
    id: "order-11",
    stopId: "stop-11",
    paymentType: "CONTADO",
    items: [
      {
        productId: "VO13",
        name: "VOLL-DAMM 1/3 RET.",
        quantity: 6,
        unit: "Caja",
        warehouseLocation: "AA07A1",
      },
      {
        productId: "VE32SP",
        name: "AGUA VERI 1,5L PET CAJA 12U.",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "EB02A1",
      },
      {
        productId: "0LT0009",
        name: "LETONA GRAN CREME 1L VR 12U",
        quantity: 1,
        unit: "Caja",
        warehouseLocation: "AC05A2",
      },
    ],
  },
  // BAR KARNAK — bar de pueblo
  {
    id: "order-12",
    stopId: "stop-12",
    paymentType: "CONTADO",
    items: [
      {
        productId: "ED13",
        name: "ESTRELLA DAMM 1/3 RET. PP",
        quantity: 14,
        unit: "Caja",
        warehouseLocation: "AA09A1",
      },
      {
        productId: "DL20",
        name: "DAMM LEMON BARRIL 20L.",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AC03A3",
      },
      {
        productId: "0AG0183",
        name: "VICHY CATALAN GAS 30CL RET 24U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "BA01A1",
      },
    ],
  },
  // L'ESPAI RESTAURANT — restaurante moderno
  {
    id: "order-13",
    stopId: "stop-13",
    paymentType: "CREDITO",
    items: [
      {
        productId: "FD13",
        name: "FREE DAMM 1/3 RET.",
        quantity: 4,
        unit: "Caja",
        warehouseLocation: "AA06A1",
      },
      {
        productId: "VO20",
        name: "VOLL DAMM BARRIL 20L.",
        quantity: 1,
        unit: "Barril",
        warehouseLocation: "AC03A2",
      },
      {
        productId: "EC13",
        name: "DAURA DAMM 1/3 RET.",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "BA05A1",
      },
      {
        productId: "0LM2484",
        name: "COMBO VASO+TAPA NAT 8OZ 250CC 50U",
        quantity: 1,
        unit: "Pack",
        warehouseLocation: "ZCG",
      },
      {
        productId: "0CF0374",
        name: "BONKA INTENSO NATURAL 1KG",
        quantity: 4,
        unit: "Unidad",
        warehouseLocation: "FC04A3",
      },
    ],
  },
  // LA COCA DE FOLGUEROLES — panadería/cafetería, última parada
  {
    id: "order-14",
    stopId: "stop-14",
    paymentType: "CREDITO",
    items: [
      {
        productId: "VE51SP",
        name: "AGUA VERI 5/1 CAJA 3U.",
        quantity: 3,
        unit: "Caja",
        warehouseLocation: "BC04A3",
      },
      {
        productId: "0LT0033",
        name: "LETONA GRAN CREME PET 1,5L PET 6U",
        quantity: 2,
        unit: "Caja",
        warehouseLocation: "FA06A3",
      },
      {
        productId: "0CF0355",
        name: "BONKA ESSENTIA DESCAFEINADO GRANO 500G",
        quantity: 2,
        unit: "Unidad",
        warehouseLocation: "FC05A3",
      },
      {
        productId: "UE975",
        name: "VASO PAPEL ED 33CL",
        quantity: 100,
        unit: "Unidad",
        warehouseLocation: "E007A1",
      },
    ],
  },
];

export const mockInputData: InputData = {
  depot: {
    id: "depot-mollet",
    name: "DDI Mollet del Vallès",
    lat: 41.5446,
    lng: 2.2125,
  },
  vehicle: {
    id: "V235045",
    type: "8_pallet_truck",
    palletSlots: 8,
    access: ["left", "right", "rear"],
    maxVolume: 14, // m³
    maxWeight: 6500, // kg
  },
  driver: {
    id: "850004",
    name: "FRAN ROMERO",
  },
  stops,
  orders,
};
