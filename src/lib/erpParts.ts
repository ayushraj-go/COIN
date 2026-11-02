// Demo ERP extract, part of the front end: every commodity in the sourcing master has part codes to pick from the first
// page load. AC = direct material, SP = indirect (spares, services, tooling), then the category: 03 metals, 05 electricals,
// 07 plastics, 09 packing, 11 chemicals & gases, 13 MRO, 15 services & facilities, 19 tooling & capex.
import type { Supplier } from './types'

/** code, description, uom, supplier, LBP (null = no LBP → PO price), PO price, last FY MRN qty */
export type PartRow = [string, string, string, string, number | null, number, number]

/** Vendors of the commodities below. They carry on from the vendor master's numbering */
export const ERP_SUPPLIERS: Omit<Supplier, 'tier'>[] = [
  { code: 'V10026', name: 'Saurashtra Brassworks Pvt Ltd', commodities: ['AX', 'FS'], contactEmail: 'sales@saurashtrabrass.in', contactName: 'Dinesh Vora', city: 'Jamnagar', spend: 62 * 1e7 },
  { code: 'V10027', name: 'Flowline Valve Industries', commodities: ['BJ', 'FZ'], contactEmail: 'orders@flowlinevalves.in', contactName: 'Sameer Kulkarni', city: 'Pune', spend: 118 * 1e7 },
  { code: 'V10028', name: 'Silverbond Brazing Alloys', commodities: ['BO', 'DB', 'FP', 'FT'], contactEmail: 'sales@silverbond.in', contactName: 'Farah Merchant', city: 'Mumbai', spend: 74 * 1e7 },
  { code: 'V10029', name: 'Capiflex Copper Industries', commodities: ['DP', 'EN', 'EO', 'HE'], contactEmail: 'kam@capiflex.in', contactName: 'Hitesh Desai', city: 'Silvassa', spend: 96 * 1e7 },
  { code: 'V10030', name: 'Coppercrest Tubes Pvt Ltd', commodities: ['BR', 'EK', 'FG', 'HA', 'HB'], contactEmail: 'sales@coppercrest.in', contactName: 'Bhavesh Amin', city: 'Vadodara', spend: 210 * 1e7 },
  { code: 'V10031', name: 'Bluewave Metals Trading', commodities: ['EM', 'FO', 'FQ', 'FR', 'HC', 'HD'], contactEmail: 'imports@bluewavemetals.in', contactName: 'Imran Sayed', city: 'Mumbai', spend: 265 * 1e7 },
  { code: 'V10032', name: 'Alumax Rolling Mills', commodities: ['DG', 'FF', 'GY'], contactEmail: 'sales@alumaxrolling.in', contactName: 'Tarun Bhatia', city: 'Silvassa', spend: 180 * 1e7 },
  { code: 'V10033', name: 'Prabhat Press Works', commodities: ['BD', 'BH', 'FJ'], contactEmail: 'orders@prabhatpress.in', contactName: 'Manoj Yadav', city: 'Faridabad', spend: 88 * 1e7 },
  { code: 'V10034', name: 'Starline Injection Moulders', commodities: ['AH', 'BG', 'FL', 'FY', 'GR', 'GS', 'GU'], contactEmail: 'kam@starlinemoulders.in', contactName: 'Pooja Rawat', city: 'Dehradun', spend: 146 * 1e7 },
  { code: 'V10035', name: 'Aeroflow Fans & Blowers', commodities: ['AZ', 'BB', 'FU', 'CX'], contactEmail: 'sales@aeroflowfans.in', contactName: 'Suresh Iyer', city: 'Hosur', spend: 132 * 1e7 },
  { code: 'V10036', name: 'Elastoseal Rubber Products', commodities: ['BI', 'FE', 'GT'], contactEmail: 'sales@elastoseal.in', contactName: 'Vikas Malhotra', city: 'Faridabad', spend: 58 * 1e7 },
  { code: 'V10037', name: 'Insulon Foam Industries', commodities: ['AU', 'FA', 'FB', 'FC'], contactEmail: 'orders@insulonfoam.in', contactName: 'Keyur Shah', city: 'Ahmedabad', spend: 66 * 1e7 },
  { code: 'V10038', name: 'Colourtech Masterbatches', commodities: ['DV', 'FV', 'GV'], contactEmail: 'trade@colourtechmb.in', contactName: 'Nimesh Patel', city: 'Daman', spend: 49 * 1e7 },
  { code: 'V10039', name: 'Recyclon Polymers', commodities: ['CB', 'GW'], contactEmail: 'trade@recyclon.in', contactName: 'Ashwin Parekh', city: 'Vapi', spend: 38 * 1e7 },
  { code: 'V10040', name: 'Fibrecast Composites', commodities: ['AI', 'FL'], contactEmail: 'sales@fibrecast.in', contactName: 'Rohan Deshpande', city: 'Pune', spend: 72 * 1e7 },
  { code: 'V10041', name: 'Zentrix Remote Controls', commodities: ['AT', 'EY', 'EZ'], contactEmail: 'bd@zentrixremotes.in', contactName: 'Anuj Saxena', city: 'Noida', spend: 84 * 1e7 },
  { code: 'V10042', name: 'Capcor Electricals', commodities: ['AY', 'BT'], contactEmail: 'sales@capcor.in', contactName: 'Deepa Hegde', city: 'Bengaluru', spend: 92 * 1e7 },
  { code: 'V10043', name: 'Logicboard Controls Pvt Ltd', commodities: ['CV', 'EB', 'EC', 'ED', 'EF', 'EG', 'EH', 'EI', 'EJ'], contactEmail: 'kam@logicboard.in', contactName: 'Kunal Verma', city: 'Noida', spend: 310 * 1e7 },
  { code: 'V10044', name: 'Brightview Display Systems', commodities: ['CW', 'EQ', 'ES', 'ET', 'EU', 'EV'], contactEmail: 'bd@brightviewdisplays.in', contactName: 'Payal Sethi', city: 'Greater Noida', spend: 170 * 1e7 },
  { code: 'V10045', name: 'Powertron Electronics', commodities: ['DT', 'EL', 'ER', 'EW', 'EX'], contactEmail: 'sales@powertronelectronics.in', contactName: 'Abhijit Joshi', city: 'Pune', spend: 225 * 1e7 },
  { code: 'V10046', name: 'Stepdrive Motors', commodities: ['DR', 'FK', 'FW', 'FX'], contactEmail: 'sales@stepdrive.in', contactName: 'Karthik Raman', city: 'Coimbatore', spend: 124 * 1e7 },
  { code: 'V10047', name: 'Kelvin Cooling Imports', commodities: ['DZ', 'EA'], contactEmail: 'imports@kelvincooling.in', contactName: 'Prasad Menon', city: 'Chennai', spend: 340 * 1e7 },
  { code: 'V10048', name: 'Voltcell Batteries', commodities: ['GA'], contactEmail: 'sales@voltcell.in', contactName: 'Srinivas Reddy', city: 'Hyderabad', spend: 18 * 1e7 },
  { code: 'V10049', name: 'Cablex Wiring Industries', commodities: ['FM'], contactEmail: 'kam@cablexwiring.in', contactName: 'Lalit Sharma', city: 'Manesar', spend: 77 * 1e7 },
  { code: 'V10050', name: 'Labelmark Print Solutions', commodities: ['AS', 'BY', 'GH', 'GI', 'GJ', 'GK', 'GL', 'GM', 'GN', 'GO', 'GP'], contactEmail: 'orders@labelmark.in', contactName: 'Geeta Bansal', city: 'Noida', spend: 54 * 1e7 },
  { code: 'V10051', name: 'Flexipak Polyfilms', commodities: ['BF', 'BK', 'BU', 'GF'], contactEmail: 'sales@flexipakfilms.in', contactName: 'Amarjit Dhillon', city: 'Rajpura', spend: 46 * 1e7 },
  { code: 'V10052', name: 'Cartonex Paper Products', commodities: ['GD', 'GE', 'GG'], contactEmail: 'orders@cartonex.in', contactName: 'Baljit Sidhu', city: 'Rajpura', spend: 39 * 1e7 },
  { code: 'V10053', name: 'Thermocore Mouldings', commodities: ['CT', 'GZ'], contactEmail: 'sales@thermocore.in', contactName: 'Naveen Dahiya', city: 'Jhajjar', spend: 41 * 1e7 },
  { code: 'V10054', name: 'Cryogas Industrial Gases', commodities: ['BC', 'DY', 'O2', 'N2', 'HEL', 'CO2', 'LPG'], contactEmail: 'bookings@cryogas.in', contactName: 'Rajat Khurana', city: 'Faridabad', spend: 128 * 1e7 },
  { code: 'V10055', name: 'Chemtron Specialities', commodities: ['BQ', 'BS', 'GB', 'PNO'], contactEmail: 'trade@chemtron.in', contactName: 'Mehul Trivedi', city: 'Vapi', spend: 63 * 1e7 },
  { code: 'V10056', name: 'Precitool Die Makers', commodities: ['CO', 'HF'], contactEmail: 'projects@precitool.in', contactName: 'Harish Arora', city: 'Faridabad', spend: 155 * 1e7 },
  { code: 'V10057', name: 'Metrolab Instruments', commodities: ['CZ', 'HL'], contactEmail: 'sales@metrolabinstruments.in', contactName: 'Lavanya Rao', city: 'Bengaluru', spend: 28 * 1e7 },
  { code: 'V10058', name: 'Sparex Electrical Stores', commodities: ['BZ'], contactEmail: 'b2b@sparexstores.in', contactName: 'Gaurav Mittal', city: 'Delhi NCR', spend: 22 * 1e7 },
  { code: 'V10059', name: 'Clearview Glass Works', commodities: ['DW'], contactEmail: 'sales@clearviewglass.in', contactName: 'Sonia Kapur', city: 'Gurugram', spend: 12 * 1e7 },
]

export const ERP_PART_ROWS: Record<string, PartRow[]> = {
  AX: [
    ['AC03120101', 'Brass flare nut 1/4 in', 'Nos', 'V10026', 18.4, 18.55, 1800000],
    ['AC03120102', 'Brass flare nut 3/8 in', 'Nos', 'V10026', 26.5, 26.71, 1500000],
    ['AC03120103', 'Brass charging nipple', 'Nos', 'V10026', 11.2, 11.29, 900000],
  ],
  BD: [
    ['AC03121101', 'Hinge pin, galvanised', 'Nos', 'V10033', 3.6, 3.63, 2200000],
    ['AC03121102', 'Spring washer M6', 'Nos', 'V10033', 0.48, 0.48, 9000000],
    ['AC03121103', 'Mounting clamp, ODU', 'Nos', 'V10033', 14.5, 14.62, 800000],
  ],
  BH: [
    ['AC03122101', 'Wall mounting bracket set, ODU', 'Set', 'V10033', 265, 267, 420000],
    ['AC03122102', 'Installation plate, IDU', 'Nos', 'V10033', 46, 46.37, 760000],
    ['AC03122103', 'Cable tie 200 mm, nylon', 'Nos', 'V10033', 1.05, 1.06, 4200000],
  ],
  BJ: [
    ['AC03123101', 'Service valve 2-way 1/4 in', 'Nos', 'V10027', 118, 119, 980000],
    ['AC03123102', 'Service valve 3-way 3/8 in', 'Nos', 'V10027', 176, 177, 860000],
    ['AC03123103', 'Service valve 3-way 1/2 in', 'Nos', 'V10027', 224, 226, 310000],
  ],
  BO: [
    ['AC03124101', 'Brazing rod 15% Ag', 'Kg', 'V10028', 7800, 7862, 18500],
    ['AC03124102', 'Brazing rod 5% Ag', 'Kg', 'V10028', 3150, 3175, 26000],
    ['AC03124103', 'Phos-copper brazing rod', 'Kg', 'V10028', 1180, 1189, 42000],
  ],
  BR: [
    ['AC03125101', 'Copper tubing set 1.5 TR, insulated', 'Set', 'V10030', 1640, 1653, 380000],
    ['AC03125102', 'Copper suction line assembly', 'Nos', 'V10030', 268, 270, 640000],
    ['AC03125103', 'Copper discharge line assembly', 'Nos', 'V10030', 214, 216, 640000],
  ],
  DB: [
    ['AC03126101', 'Brazing ring Ø7 mm, imported', 'Nos', 'V10028', 3.85, 3.88, 6400000],
    ['AC03126102', 'Brazing ring Ø9.52 mm, imported', 'Nos', 'V10028', 5.2, 5.24, 4100000],
    ['AC03126103', 'Brazing ring Ø12.7 mm, imported', 'Nos', 'V10028', 7.4, 7.46, 1200000],
  ],
  DG: [
    ['AC03127101', 'Aluminium ingot LM6', 'Kg', 'V10032', 238, 240, 2600000],
    ['AC03127102', 'Aluminium billet 6063', 'Kg', 'V10032', 252, 254, 1800000],
    ['AC03127103', 'Aluminium wire rod Ø9.5 mm', 'Kg', 'V10032', 244, 246, 900000],
  ],
  DP: [
    ['AC03128101', 'Capillary tube Ø1.63 mm, cut length', 'Nos', 'V10029', 8.6, 8.67, 3400000],
    ['AC03128102', 'Capillary tube Ø2.03 mm, cut length', 'Nos', 'V10029', 10.4, 10.48, 2100000],
    ['AC03128103', 'Capillary assembly with strainer', 'Nos', 'V10029', 42, 42.34, 760000],
  ],
  EK: [
    ['AC03129101', 'Copper strip 0.5 mm, customer supplied', 'Kg', 'V10030', 826, 833, 240000],
    ['AC03129102', 'Copper rod Ø8 mm, customer supplied', 'Kg', 'V10030', 812, 818, 310000],
    ['AC03129103', 'Copper header blank, customer supplied', 'Nos', 'V10030', 38, 38.3, 520000],
  ],
  EM: [
    ['AC03130101', 'Copper tube Ø7 mm IGT, imported', 'Kg', 'V10031', 896, 903, 980000],
    ['AC03130102', 'Copper tube Ø9.52 mm IGT, imported', 'Kg', 'V10031', 884, 891, 760000],
    ['AC03130103', 'Copper tube Ø5 mm IGT, imported', 'Kg', 'V10031', 918, 925, 320000],
  ],
  EN: [
    ['AC03131101', 'Capillary mother coil Ø1.63 mm', 'Kg', 'V10029', 905, 912, 62000],
    ['AC03131102', 'Capillary mother coil Ø2.03 mm', 'Kg', 'V10029', 892, 899, 48000],
    ['AC03131103', 'Capillary mother coil Ø2.41 mm', 'Kg', 'V10029', 884, 891, 21000],
  ],
  EO: [
    ['AC03132101', 'Capillary sub-assembly 1.0 TR', 'Nos', 'V10029', 34, 34.27, 540000],
    ['AC03132102', 'Capillary sub-assembly 1.5 TR', 'Nos', 'V10029', 39, 39.31, 1100000],
    ['AC03132103', 'Capillary sub-assembly 2.0 TR', 'Nos', 'V10029', 46, 46.37, 290000],
  ],
  FF: [
    ['AC03133101', 'Aluminium extrusion profile, IDU frame', 'Kg', 'V10032', 286, 288, 410000],
    ['AC03133102', 'Aluminium end plate blank', 'Nos', 'V10032', 12.6, 12.7, 1900000],
    ['AC03133103', 'Aluminium tube Ø8 mm', 'Kg', 'V10032', 312, 314, 260000],
  ],
  FG: [
    ['AC03134101', 'Copper sheet 0.6 mm', 'Kg', 'V10030', 834, 841, 180000],
    ['AC03134102', 'Copper return bend blank', 'Nos', 'V10030', 4.7, 4.74, 7800000],
    ['AC03134103', 'Copper tee blank 3/8 in', 'Nos', 'V10030', 9.8, 9.88, 1400000],
  ],
  FJ: [
    ['AC03135101', 'CRCA blank, ODU top cover', 'Nos', 'V10033', 62, 62.5, 820000],
    ['AC03135102', 'GI blank, chassis base', 'Nos', 'V10033', 94, 94.75, 950000],
    ['AC03135103', 'GI blank, IDU back plate', 'Nos', 'V10033', 37, 37.3, 1050000],
  ],
  FO: [
    ['AC03136101', 'Aluminium strip 0.2 mm, imported', 'Kg', 'V10031', 342, 345, 520000],
    ['AC03136102', 'Aluminium strip 0.3 mm, imported', 'Kg', 'V10031', 336, 339, 410000],
    ['AC03136103', 'Aluminium clad strip 0.4 mm, imported', 'Kg', 'V10031', 388, 391, 190000],
  ],
  FP: [
    ['AC03137101', 'Aluminium brazing filler wire Ø2 mm, imported', 'Kg', 'V10028', 1260, 1270, 16000],
    ['AC03137102', 'Aluminium brazing paste, imported', 'Kg', 'V10028', 2140, 2157, 6500],
    ['AC03137103', 'Aluminium brazing ring Ø8 mm, imported', 'Nos', 'V10028', 6.3, 6.35, 1300000],
  ],
  FQ: [
    ['AC03138101', 'Aluminium pipe Ø9.52 mm, imported', 'Kg', 'V10031', 398, 401, 280000],
    ['AC03138102', 'Aluminium micro-channel tube, imported', 'Kg', 'V10031', 472, 476, 140000],
    ['AC03138103', 'Aluminium suction pipe Ø12.7 mm, imported', 'Kg', 'V10031', 405, 408, 120000],
  ],
  FR: [
    ['AC03139101', 'Hydrophilic foil 0.095 mm, imported', 'Kg', 'V10031', 334, 337, 1600000],
    ['AC03139102', 'Hydrophilic foil 0.105 mm, imported', 'Kg', 'V10031', 328, 331, 1150000],
    ['AC03139103', 'Bare aluminium foil 0.1 mm, imported', 'Kg', 'V10031', 306, 308, 640000],
  ],
  FS: [
    ['AC03140101', 'Brass valve body forging, imported', 'Nos', 'V10026', 64, 64.51, 540000],
    ['AC03140102', 'Brass distributor, imported', 'Nos', 'V10026', 88, 88.7, 320000],
    ['AC03140103', 'Brass stem, imported', 'Nos', 'V10026', 21, 21.17, 760000],
  ],
  FT: [
    ['AC03141101', 'Brazing rod 30% Ag, imported', 'Kg', 'V10028', 12600, 12701, 4200],
    ['AC03141102', 'Brazing rod 15% Ag, imported', 'Kg', 'V10028', 8240, 8306, 7800],
    ['AC03141103', 'Phos-copper rod, imported', 'Kg', 'V10028', 1310, 1320, 11000],
  ],
  FZ: [
    ['AC03142101', 'Service valve 2-way 1/4 in, imported', 'Nos', 'V10027', 132, 133, 260000],
    ['AC03142102', 'Service valve 3-way 3/8 in, imported', 'Nos', 'V10027', 194, 196, 240000],
    ['AC03142103', 'Service valve 3-way 5/8 in, imported', 'Nos', 'V10027', 286, 288, 64000],
  ],
  GY: [
    ['AC03143101', 'Hydrophilic foil 0.095 mm, local', 'Kg', 'V10032', 322, 325, 2200000],
    ['AC03143102', 'Hydrophilic foil 0.115 mm, local', 'Kg', 'V10032', 317, 320, 1400000],
    ['AC03143103', 'Bare aluminium foil 0.13 mm, local', 'Kg', 'V10032', 296, 298, 820000],
  ],
  HA: [
    ['AC03144101', 'Copper tube plain Ø6.35 mm', 'Kg', 'V10030', 842, 849, 540000],
    ['AC03144102', 'Copper tube plain Ø9.52 mm', 'Kg', 'V10030', 838, 845, 720000],
    ['AC03144103', 'Copper tube plain Ø12.7 mm', 'Kg', 'V10030', 832, 839, 460000],
  ],
  HB: [
    ['AC03145101', 'Copper tube IGT Ø7 mm', 'Kg', 'V10030', 868, 875, 1500000],
    ['AC03145102', 'Copper tube IGT Ø9.52 mm', 'Kg', 'V10030', 858, 865, 1150000],
    ['AC03145103', 'Copper tube IGT Ø5 mm', 'Kg', 'V10030', 886, 893, 420000],
  ],
  HC: [
    ['AC03146101', 'Copper tube plain Ø6.35 mm, imported', 'Kg', 'V10031', 872, 879, 210000],
    ['AC03146102', 'Copper tube plain Ø9.52 mm, imported', 'Kg', 'V10031', 866, 873, 260000],
    ['AC03146103', 'Copper tube plain Ø15.88 mm, imported', 'Kg', 'V10031', 854, 861, 95000],
  ],
  HD: [
    ['AC03147101', 'Copper tube IGT Ø7 mm thin wall, imported', 'Kg', 'V10031', 908, 915, 640000],
    ['AC03147102', 'Copper tube IGT Ø9.52 mm thin wall, imported', 'Kg', 'V10031', 894, 901, 510000],
    ['AC03147103', 'Copper tube IGT Ø5 mm thin wall, imported', 'Kg', 'V10031', 926, 933, 230000],
  ],
  HE: [
    ['AC03148101', 'Copper capillary tube Ø1.4 mm', 'Kg', 'V10029', 936, 943, 34000],
    ['AC03148102', 'Copper capillary tube Ø1.63 mm', 'Kg', 'V10029', 921, 928, 72000],
    ['AC03148103', 'Copper capillary tube Ø2.03 mm', 'Kg', 'V10029', 908, 915, 56000],
  ],
  AH: [
    ['AC07149101', 'PLC moulded IDU cabinet set', 'Set', 'V10034', 540, 544, 360000],
    ['AC07149102', 'PLC moulded ODU top cover', 'Nos', 'V10034', 168, 169, 420000],
    ['AC07149103', 'PLC moulded drain pan', 'Nos', 'V10034', 92, 92.74, 780000],
  ],
  AI: [
    ['AC07150101', 'SMC electrical box cover', 'Nos', 'V10040', 148, 149, 240000],
    ['AC07150102', 'SMC terminal cover', 'Nos', 'V10040', 64, 64.51, 320000],
    ['AC07150103', 'SMC control box base', 'Nos', 'V10040', 126, 127, 210000],
  ],
  AU: [
    ['AC07151101', 'PU foam strip 10 × 5 mm', 'Mtr', 'V10037', 6.2, 6.25, 5200000],
    ['AC07151102', 'Seal foam, evaporator', 'Nos', 'V10037', 4.4, 4.44, 3100000],
    ['AC07151103', 'Acoustic foam, compressor jacket', 'Nos', 'V10037', 38, 38.3, 880000],
  ],
  AZ: [
    ['AC07152101', 'Cross flow fan Ø90 × 650 mm', 'Nos', 'V10035', 212, 214, 1100000],
    ['AC07152102', 'Cross flow fan Ø95 × 720 mm', 'Nos', 'V10035', 238, 240, 780000],
    ['AC07152103', 'Cross flow fan Ø98 × 800 mm', 'Nos', 'V10035', 266, 268, 340000],
  ],
  BB: [
    ['AC07153101', 'Axial fan Ø420 mm, ODU', 'Nos', 'V10035', 96, 96.77, 1250000],
    ['AC07153102', 'Axial fan Ø460 mm, ODU', 'Nos', 'V10035', 118, 119, 740000],
    ['AC07153103', 'Axial fan Ø520 mm, ODU', 'Nos', 'V10035', 146, 147, 310000],
  ],
  BG: [
    ['AC07154101', 'Rear grill, ODU 1.0 TR', 'Nos', 'V10034', 72, 72.58, 540000],
    ['AC07154102', 'Rear grill, ODU 1.5 TR', 'Nos', 'V10034', 84, 84.67, 980000],
    ['AC07154103', 'Rear grill, WAC', 'Nos', 'V10034', 61, 61.49, 260000],
  ],
  BI: [
    ['AC07155101', 'Compressor grommet, EPDM', 'Nos', 'V10036', 3.8, 3.83, 6200000],
    ['AC07155102', 'Drain plug, rubber', 'Nos', 'V10036', 2.4, 2.42, 1800000],
    ['AC07155103', 'Vibration damper, ODU', 'Nos', 'V10036', 7.6, 7.66, 2700000],
  ],
  CB: [
    ['AC07156101', 'ABS regrind, natural', 'Kg', 'V10039', 86, 86.69, 640000],
    ['AC07156102', 'PP regrind, black', 'Kg', 'V10039', 62, 62.5, 820000],
    ['AC07156103', 'HIPS regrind, white', 'Kg', 'V10039', 74, 74.59, 360000],
  ],
  DV: [
    ['AC07157101', 'White master batch, ABS', 'Kg', 'V10038', 236, 238, 210000],
    ['AC07157102', 'Black master batch, PP', 'Kg', 'V10038', 148, 149, 260000],
    ['AC07157103', 'UV stabiliser master batch', 'Kg', 'V10038', 412, 415, 62000],
  ],
  FA: [
    ['AC07158101', 'PVC sleeve Ø6 mm', 'Mtr', 'V10037', 2.1, 2.12, 7800000],
    ['AC07158102', 'Heat-shrink sleeve Ø4 mm', 'Mtr', 'V10037', 3.4, 3.43, 3200000],
    ['AC07158103', 'Fibreglass sleeve Ø8 mm', 'Mtr', 'V10037', 7.2, 7.26, 940000],
  ],
  FB: [
    ['AC07159101', 'PE insulation tube Ø9.52 × 6 mm', 'Mtr', 'V10037', 11.6, 11.69, 4100000],
    ['AC07159102', 'PE insulation tube Ø15.88 × 9 mm', 'Mtr', 'V10037', 17.4, 17.54, 2300000],
    ['AC07159103', 'Nitrile insulation tube Ø12.7 × 9 mm', 'Mtr', 'V10037', 24, 24.19, 860000],
  ],
  FC: [
    ['AC07160101', 'Compressor sound jacket, 1.5 TR', 'Nos', 'V10037', 76, 76.61, 820000],
    ['AC07160102', 'Compressor sound jacket, 2.0 TR', 'Nos', 'V10037', 92, 92.74, 230000],
    ['AC07160103', 'Accumulator jacket', 'Nos', 'V10037', 28, 28.22, 640000],
  ],
  FE: [
    ['AC07161101', 'EPDM compound, 60 shore', 'Kg', 'V10036', 198, 200, 120000],
    ['AC07161102', 'Nitrile compound, 70 shore', 'Kg', 'V10036', 246, 248, 64000],
    ['AC07161103', 'Silicone compound, 50 shore', 'Kg', 'V10036', 412, 415, 18000],
  ],
  FL: [
    ['AC07162101', 'Air filter mesh, IDU', 'Nos', 'V10034', 8.4, 8.47, 2600000],
    ['AC07162102', 'PM 2.5 filter, IDU', 'Nos', 'V10040', 42, 42.34, 640000],
    ['AC07162103', 'Antibacterial filter, IDU', 'Nos', 'V10040', 31, 31.25, 560000],
  ],
  FU: [
    ['AC07163101', 'Cross flow fan Ø90 × 650 mm, imported', 'Nos', 'V10035', 248, 250, 240000],
    ['AC07163102', 'Cross flow fan Ø98 × 800 mm, imported', 'Nos', 'V10035', 304, 306, 96000],
    ['AC07163103', 'Cross flow fan blade set, imported', 'Set', 'V10035', 186, 187, 130000],
  ],
  FV: [
    ['AC07164101', 'Moulding powder, urea formaldehyde', 'Kg', 'V10038', 128, 129, 92000],
    ['AC07164102', 'Mould release compound', 'Kg', 'V10038', 344, 347, 14000],
    ['AC07164103', 'Purging compound', 'Kg', 'V10038', 286, 288, 21000],
  ],
  FY: [
    ['AC07165101', 'Swing louver blade, imported', 'Nos', 'V10034', 11.4, 11.49, 1600000],
    ['AC07165102', 'Knob and gear set, imported', 'Set', 'V10034', 23, 23.18, 720000],
    ['AC07165103', 'Drain pan insert, imported', 'Nos', 'V10034', 38, 38.3, 410000],
  ],
  GR: [
    ['AC07166101', 'IDU front grill 1.0 TR, white', 'Nos', 'V10034', 214, 216, 620000],
    ['AC07166102', 'IDU front grill 1.5 TR, white', 'Nos', 'V10034', 248, 250, 1050000],
    ['AC07166103', 'IDU front grill 2.0 TR, white', 'Nos', 'V10034', 286, 288, 260000],
  ],
  GS: [
    ['AC07167101', 'ODU fan guard Ø420 mm', 'Nos', 'V10034', 58, 58.46, 1150000],
    ['AC07167102', 'ODU fan guard Ø460 mm', 'Nos', 'V10034', 66, 66.53, 720000],
    ['AC07167103', 'ODU fan guard Ø520 mm', 'Nos', 'V10034', 79, 79.63, 290000],
  ],
  GT: [
    ['AC07168101', 'IDU drain hose Ø16 mm × 1 m', 'Nos', 'V10036', 19, 19.15, 2100000],
    ['AC07168102', 'IDU drain hose Ø16 mm × 2 m', 'Nos', 'V10036', 33, 33.26, 560000],
    ['AC07168103', 'Drain hose extension joint', 'Nos', 'V10036', null, 6.8, 940000],
  ],
  GU: [
    ['AC07169101', 'WAC front grill 1.0 TR', 'Nos', 'V10034', 276, 278, 190000],
    ['AC07169102', 'WAC front grill 1.5 TR', 'Nos', 'V10034', 312, 314, 240000],
    ['AC07169103', 'WAC front grill 2.0 TR', 'Nos', 'V10034', 348, 351, 82000],
  ],
  GV: [
    ['AC07170101', 'White master batch, customer supplied', 'Kg', 'V10038', 242, 244, 84000],
    ['AC07170102', 'Grey master batch, customer supplied', 'Kg', 'V10038', 224, 226, 46000],
    ['AC07170103', 'Black master batch, customer supplied', 'Kg', 'V10038', 156, 157, 73000],
  ],
  GW: [
    ['AC07171101', 'ABS granules, customer supplied', 'Kg', 'V10039', 172, 173, 940000],
    ['AC07171102', 'PP granules, customer supplied', 'Kg', 'V10039', 116, 117, 760000],
    ['AC07171103', 'HIPS granules, customer supplied', 'Kg', 'V10039', 138, 139, 420000],
  ],
  AT: [
    ['AC05172101', 'Remote control, 1.5 TR inverter', 'Nos', 'V10041', 86, 86.69, 1450000],
    ['AC05172102', 'Remote control, WAC', 'Nos', 'V10041', 62, 62.5, 420000],
    ['AC05172103', 'Remote control holder', 'Nos', 'V10041', null, 4.6, 1800000],
  ],
  AY: [
    ['AC05173101', 'Run capacitor 35 µF 440 V', 'Nos', 'V10042', 96, 96.77, 1200000],
    ['AC05173102', 'Run capacitor 2.5 µF 440 V', 'Nos', 'V10042', 24, 24.19, 1700000],
    ['AC05173103', 'Film capacitor 1 µF 275 V', 'Nos', 'V10042', 7.8, 7.86, 3600000],
  ],
  BT: [
    ['AC05174101', 'Terminal block 3-way, 25 A', 'Nos', 'V10042', 18, 18.14, 2100000],
    ['AC05174102', 'Terminal block 5-way, 25 A', 'Nos', 'V10042', 31, 31.25, 1300000],
    ['AC05174103', 'Terminal block 6-way, 30 A', 'Nos', 'V10042', 44, 44.35, 640000],
  ],
  CV: [
    ['AC05175101', 'Main controller, split AC', 'Nos', 'V10043', 684, 689, 640000],
    ['AC05175102', 'Wired wall controller', 'Nos', 'V10043', 412, 415, 120000],
    ['AC05175103', 'Wi-Fi controller module', 'Nos', 'V10043', null, 236, 380000],
  ],
  CW: [
    ['AC05176101', 'Display PCB, 4-digit LED', 'Nos', 'V10044', 124, 125, 940000],
    ['AC05176102', 'Display PCB, hidden LED', 'Nos', 'V10044', 146, 147, 520000],
    ['AC05176103', 'Receiver PCB, IR', 'Nos', 'V10044', 38, 38.3, 1400000],
  ],
  CX: [
    ['AC05177101', 'Centrifugal blower, ducted 1.5 TR', 'Nos', 'V10035', 1420, 1431, 86000],
    ['AC05177102', 'Centrifugal blower, ducted 3.0 TR', 'Nos', 'V10035', 2160, 2177, 42000],
    ['AC05177103', 'Blower wheel Ø146 mm', 'Nos', 'V10035', 268, 270, 210000],
  ],
  DR: [
    ['AC05178101', 'Stepping motor 12 V, horizontal louver', 'Nos', 'V10046', 58, 58.46, 1300000],
    ['AC05178102', 'Stepping motor 12 V, vertical louver', 'Nos', 'V10046', 64, 64.51, 860000],
    ['AC05178103', 'Synchronous swing motor 230 V', 'Nos', 'V10046', 92, 92.74, 240000],
  ],
  DT: [
    ['AC05179101', 'Main PCB, fixed speed 1.5 TR', 'Nos', 'V10045', 468, 472, 720000],
    ['AC05179102', 'Main PCB, inverter IDU', 'Nos', 'V10045', 612, 617, 860000],
    ['AC05179103', 'Main PCB, WAC', 'Nos', 'V10045', 398, 401, 310000],
  ],
  DZ: [
    ['AC05180101', 'Rotary compressor 1.5 TR, customer supplied', 'Nos', 'V10047', 7720, 7782, 240000],
    ['AC05180102', 'Rotary compressor 1.0 TR, customer supplied', 'Nos', 'V10047', 6310, 6360, 180000],
    ['AC05180103', 'Scroll compressor 3.0 TR, customer supplied', 'Nos', 'V10047', 15800, 15926, 42000],
  ],
  EA: [
    ['AC05181101', 'Rotary compressor 1.5 TR R32, imported', 'Nos', 'V10047', 8120, 8185, 360000],
    ['AC05181102', 'Twin rotary compressor 2.0 TR, imported', 'Nos', 'V10047', 11400, 11491, 140000],
    ['AC05181103', 'Scroll compressor 3.0 TR, imported', 'Nos', 'V10047', 16600, 16733, 38000],
  ],
  EB: [
    ['AC05182101', 'IDU controller 1.0 TR, customer supplied', 'Nos', 'V10043', 612, 617, 210000],
    ['AC05182102', 'IDU controller 1.5 TR, customer supplied', 'Nos', 'V10043', 648, 653, 340000],
    ['AC05182103', 'IDU controller 2.0 TR, customer supplied', 'Nos', 'V10043', 702, 708, 96000],
  ],
  EC: [
    ['AC05183101', 'ODU controller 1.0 TR, customer supplied', 'Nos', 'V10043', 1840, 1855, 180000],
    ['AC05183102', 'ODU controller 1.5 TR, customer supplied', 'Nos', 'V10043', 2160, 2177, 310000],
    ['AC05183103', 'ODU controller 2.0 TR, customer supplied', 'Nos', 'V10043', 2490, 2510, 88000],
  ],
  ED: [
    ['AC05184101', 'WAC controller 1.0 TR, customer supplied', 'Nos', 'V10043', 524, 528, 62000],
    ['AC05184102', 'WAC controller 1.5 TR, customer supplied', 'Nos', 'V10043', 566, 571, 94000],
    ['AC05184103', 'WAC controller 2.0 TR, customer supplied', 'Nos', 'V10043', 618, 623, 31000],
  ],
  EF: [
    ['AC05185101', 'IDU controller 1.0 TR', 'Nos', 'V10043', 596, 601, 420000],
    ['AC05185102', 'IDU controller 1.5 TR', 'Nos', 'V10043', 632, 637, 760000],
    ['AC05185103', 'IDU controller 2.0 TR', 'Nos', 'V10043', 688, 694, 190000],
  ],
  EG: [
    ['AC05186101', 'IDU controller 1.0 TR, imported', 'Nos', 'V10043', 654, 659, 110000],
    ['AC05186102', 'IDU controller 1.5 TR, imported', 'Nos', 'V10043', 694, 700, 180000],
    ['AC05186103', 'IDU controller 2.0 TR, imported', 'Nos', 'V10043', 748, 754, 52000],
  ],
  EH: [
    ['AC05187101', 'ODU controller 1.0 TR, imported', 'Nos', 'V10043', 1960, 1976, 92000],
    ['AC05187102', 'ODU controller 1.5 TR, imported', 'Nos', 'V10043', 2290, 2308, 160000],
    ['AC05187103', 'ODU controller 2.0 TR, imported', 'Nos', 'V10043', 2640, 2661, 46000],
  ],
  EI: [
    ['AC05188101', 'WAC controller 1.0 TR, imported', 'Nos', 'V10043', 556, 560, 28000],
    ['AC05188102', 'WAC controller 1.5 TR, imported', 'Nos', 'V10043', 604, 609, 46000],
    ['AC05188103', 'WAC controller 2.0 TR, imported', 'Nos', 'V10043', 652, 657, 15000],
  ],
  EJ: [
    ['AC05189101', 'WAC controller 1.0 TR', 'Nos', 'V10043', 508, 512, 96000],
    ['AC05189102', 'WAC controller 1.5 TR', 'Nos', 'V10043', 548, 552, 140000],
    ['AC05189103', 'WAC controller 2.0 TR', 'Nos', 'V10043', 598, 603, 47000],
  ],
  EL: [
    ['AC05190101', 'Electrical box assembly, ODU', 'Nos', 'V10045', 386, 389, 540000],
    ['AC05190102', 'Reactor assembly, inverter ODU', 'Nos', 'V10045', 294, 296, 360000],
    ['AC05190103', 'Transformer assembly, IDU', 'Nos', 'V10045', 118, 119, 680000],
  ],
  EQ: [
    ['AC05191101', 'IDU display PCB, LED, customer supplied', 'Nos', 'V10044', 132, 133, 180000],
    ['AC05191102', 'IDU display PCB, hidden LED, customer supplied', 'Nos', 'V10044', 152, 153, 120000],
    ['AC05191103', 'IDU receiver PCB, customer supplied', 'Nos', 'V10044', 41, 41.33, 260000],
  ],
  ER: [
    ['AC05192101', 'Relay 12 V, 16 A', 'Nos', 'V10045', 34, 34.27, 1800000],
    ['AC05192102', 'Fuse 3.15 A, time-lag', 'Nos', 'V10045', 2.6, 2.62, 5400000],
    ['AC05192103', 'Thermistor sensor, 5 kΩ', 'Nos', 'V10045', 12.4, 12.5, 4200000],
  ],
  ES: [
    ['AC05193101', 'IDU display PCB, LED', 'Nos', 'V10044', 128, 129, 420000],
    ['AC05193102', 'IDU display PCB, hidden LED', 'Nos', 'V10044', 148, 149, 310000],
    ['AC05193103', 'IDU receiver PCB', 'Nos', 'V10044', 36, 36.29, 640000],
  ],
  ET: [
    ['AC05194101', 'IDU display PCB, LED, imported', 'Nos', 'V10044', 142, 143, 96000],
    ['AC05194102', 'IDU display PCB, hidden LED, imported', 'Nos', 'V10044', 164, 165, 72000],
    ['AC05194103', 'IDU receiver PCB, imported', 'Nos', 'V10044', 44, 44.35, 130000],
  ],
  EU: [
    ['AC05195101', 'WAC display PCB, push button, imported', 'Nos', 'V10044', 118, 119, 38000],
    ['AC05195102', 'WAC display PCB, touch, imported', 'Nos', 'V10044', 156, 157, 24000],
    ['AC05195103', 'WAC receiver PCB, imported', 'Nos', 'V10044', 39, 39.31, 52000],
  ],
  EV: [
    ['AC05196101', 'WAC display PCB, push button', 'Nos', 'V10044', 106, 107, 110000],
    ['AC05196102', 'WAC display PCB, touch', 'Nos', 'V10044', 142, 143, 64000],
    ['AC05196103', 'WAC receiver PCB', 'Nos', 'V10044', 33, 33.26, 150000],
  ],
  EW: [
    ['AC05197101', 'Relay 12 V, 16 A, customer supplied', 'Nos', 'V10045', 36, 36.29, 420000],
    ['AC05197102', 'IPM module 15 A, customer supplied', 'Nos', 'V10045', 312, 314, 260000],
    ['AC05197103', 'Thermistor sensor, customer supplied', 'Nos', 'V10045', 13, 13.1, 980000],
  ],
  EX: [
    ['AC05198101', 'IPM module 15 A, imported', 'Nos', 'V10045', 338, 341, 540000],
    ['AC05198102', 'MCU 32-bit, imported', 'Nos', 'V10045', 126, 127, 1100000],
    ['AC05198103', 'Electrolytic capacitor 470 µF, imported', 'Nos', 'V10045', 18.6, 18.75, 1600000],
  ],
  EY: [
    ['AC05199101', 'Remote control 1.5 TR, customer supplied', 'Nos', 'V10041', 92, 92.74, 310000],
    ['AC05199102', 'Remote control WAC, customer supplied', 'Nos', 'V10041', 66, 66.53, 88000],
    ['AC05199103', 'Remote control with Wi-Fi key, customer supplied', 'Nos', 'V10041', 118, 119, 64000],
  ],
  EZ: [
    ['AC05200101', 'Remote control 1.5 TR, imported', 'Nos', 'V10041', 98, 98.78, 260000],
    ['AC05200102', 'Backlit remote control, imported', 'Nos', 'V10041', 134, 135, 96000],
    ['AC05200103', 'Remote control WAC, imported', 'Nos', 'V10041', 71, 71.57, 74000],
  ],
  FK: [
    ['AC05201101', 'BLDC fan motor 40 W, customer supplied', 'Nos', 'V10046', 1090, 1099, 180000],
    ['AC05201102', 'PSC fan motor 60 W, customer supplied', 'Nos', 'V10046', 868, 875, 120000],
    ['AC05201103', 'BLDC fan motor 90 W, customer supplied', 'Nos', 'V10046', 1460, 1472, 64000],
  ],
  FM: [
    ['AC05202101', 'Power cord 3-core, customer supplied', 'Nos', 'V10049', 136, 137, 360000],
    ['AC05202102', 'Interconnect cable 4-core, customer supplied', 'Nos', 'V10049', 372, 375, 210000],
    ['AC05202103', 'Sensor wire harness, customer supplied', 'Nos', 'V10049', 48, 48.38, 540000],
  ],
  FW: [
    ['AC05203101', 'Stepping motor 12 V, imported', 'Nos', 'V10046', 66, 66.53, 420000],
    ['AC05203102', 'Stepping motor 5 V, imported', 'Nos', 'V10046', 54, 54.43, 280000],
    ['AC05203103', 'Swing motor 230 V, imported', 'Nos', 'V10046', 104, 105, 76000],
  ],
  FX: [
    ['AC05204101', 'BLDC indoor fan motor 40 W, imported', 'Nos', 'V10046', 1210, 1220, 240000],
    ['AC05204102', 'BLDC outdoor fan motor 90 W, imported', 'Nos', 'V10046', 1620, 1633, 130000],
    ['AC05204103', 'PSC outdoor fan motor 60 W, imported', 'Nos', 'V10046', 948, 956, 96000],
  ],
  GA: [
    ['AC05205101', 'Remote battery AAA, pair', 'Set', 'V10048', 9.5, 9.58, 2400000],
    ['AC05205102', 'Coin cell CR2032', 'Nos', 'V10048', 6.2, 6.25, 1100000],
    ['AC05205103', 'RTC backup battery', 'Nos', 'V10048', 38, 38.3, 64000],
  ],
  AS: [
    ['AC09206101', 'Model sticker, IDU', 'Nos', 'V10050', 1.4, 1.41, 3600000],
    ['AC09206102', 'Carton sticker', 'Nos', 'V10050', 1.1, 1.11, 4200000],
    ['AC09206103', 'Caution label, refrigerant', 'Nos', 'V10050', 0.85, 0.86, 3300000],
  ],
  BF: [
    ['AC09207101', 'Poly bag, IDU 1.5 TR', 'Nos', 'V10051', 8.2, 8.27, 1500000],
    ['AC09207102', 'Poly bag, ODU', 'Nos', 'V10051', 11.6, 11.69, 1300000],
    ['AC09207103', 'Poly bag, accessory kit', 'Nos', 'V10051', 1.9, 1.92, 2800000],
  ],
  BK: [
    ['AC09208101', 'BOPP tape 48 mm × 65 m', 'Nos', 'V10051', 46, 46.37, 410000],
    ['AC09208102', 'Aluminium tape 50 mm × 50 m', 'Nos', 'V10051', 118, 119, 96000],
    ['AC09208103', 'PVC insulation tape 18 mm', 'Nos', 'V10051', 12, 12.1, 640000],
  ],
  BU: [
    ['AC09209101', 'Bubble sheet 1 m wide', 'Mtr', 'V10051', 14.5, 14.62, 980000],
    ['AC09209102', 'Stretch film 500 mm', 'Kg', 'V10051', 148, 149, 180000],
    ['AC09209103', 'Protective film, front grill', 'Nos', 'V10051', 3.4, 3.43, 1800000],
  ],
  BY: [
    ['AC09210101', 'Warranty card', 'Nos', 'V10050', 2.2, 2.22, 2100000],
    ['AC09210102', 'Production route card', 'Nos', 'V10050', 1.6, 1.61, 1200000],
    ['AC09210103', 'Inspection tag', 'Nos', 'V10050', 0.9, 0.91, 2400000],
  ],
  CT: [
    ['AC09211101', 'EPS assembly, drain pan', 'Nos', 'V10053', 34, 34.27, 1100000],
    ['AC09211102', 'EPS assembly, IDU back', 'Nos', 'V10053', 46, 46.37, 820000],
    ['AC09211103', 'EPS assembly, ODU base', 'Nos', 'V10053', 58, 58.46, 640000],
  ],
  GD: [
    ['AC09212101', 'Paper edge angle 50 × 50 mm × 1 m', 'Nos', 'V10052', 8.6, 8.67, 2600000],
    ['AC09212102', 'Paper edge angle 60 × 60 mm × 1.2 m', 'Nos', 'V10052', 12.2, 12.3, 1500000],
    ['AC09212103', 'Plastic edge protector', 'Nos', 'V10052', 3.8, 3.83, 1200000],
  ],
  GE: [
    ['AC09213101', 'Corrugated separator, IDU', 'Nos', 'V10052', 18, 18.14, 1400000],
    ['AC09213102', 'Corrugated separator, ODU', 'Nos', 'V10052', 26, 26.21, 1200000],
    ['AC09213103', 'Corrugated pallet sheet', 'Nos', 'V10052', 64, 64.51, 180000],
  ],
  GF: [
    ['AC09214101', 'PP strapping band 12 mm', 'Kg', 'V10051', 124, 125, 210000],
    ['AC09214102', 'PP strapping band 15 mm', 'Kg', 'V10051', 118, 119, 160000],
    ['AC09214103', 'PP band clip', 'Nos', 'V10051', 0.7, 0.71, 3200000],
  ],
  GG: [
    ['AC09215101', 'Carton staple pin 35 mm', 'Kg', 'V10052', 118, 119, 56000],
    ['AC09215102', 'Carton staple pin 18 mm', 'Kg', 'V10052', 124, 125, 34000],
    ['AC09215103', 'Stitching wire coil', 'Kg', 'V10052', 96, 96.77, 42000],
  ],
  GH: [
    ['AC09216101', 'Wiring diagram sticker, IDU', 'Nos', 'V10050', 1.8, 1.81, 2900000],
    ['AC09216102', 'Wiring diagram sticker, ODU', 'Nos', 'V10050', 2.1, 2.12, 2700000],
    ['AC09216103', 'Wiring diagram sticker, WAC', 'Nos', 'V10050', 1.9, 1.92, 640000],
  ],
  GI: [
    ['AC09217101', 'Strip sticker, front panel', 'Nos', 'V10050', 1.2, 1.21, 2200000],
    ['AC09217102', 'Strip sticker, inverter badge', 'Nos', 'V10050', 1.5, 1.51, 1600000],
    ['AC09217103', 'Strip sticker, filter clean', 'Nos', 'V10050', 0.9, 0.91, 1800000],
  ],
  GJ: [
    ['AC09218101', 'SOWM label, 1.0 TR', 'Nos', 'V10050', 0.95, 0.96, 840000],
    ['AC09218102', 'SOWM label, 1.5 TR', 'Nos', 'V10050', 0.95, 0.96, 1400000],
    ['AC09218103', 'SOWM label, WAC', 'Nos', 'V10050', 0.9, 0.91, 420000],
  ],
  GK: [
    ['AC09219101', 'Thermal transfer ribbon 110 mm × 300 m', 'Nos', 'V10050', 310, 312, 18000],
    ['AC09219102', 'Thermal transfer ribbon 60 mm × 300 m', 'Nos', 'V10050', 196, 198, 12000],
    ['AC09219103', 'Wax-resin ribbon 110 mm', 'Nos', 'V10050', 268, 270, 9000],
  ],
  GL: [
    ['AC09220101', 'Rating label, 1.0 TR', 'Nos', 'V10050', 1.3, 1.31, 820000],
    ['AC09220102', 'Rating label, 1.5 TR', 'Nos', 'V10050', 1.3, 1.31, 1500000],
    ['AC09220103', 'Rating label, 2.0 TR', 'Nos', 'V10050', 1.35, 1.36, 390000],
  ],
  GM: [
    ['AC09221101', 'User manual, split AC', 'Nos', 'V10050', 7.4, 7.46, 1900000],
    ['AC09221102', 'Installation manual', 'Nos', 'V10050', 5.6, 5.64, 1700000],
    ['AC09221103', 'User manual, WAC', 'Nos', 'V10050', 6.2, 6.25, 420000],
  ],
  GN: [
    ['AC09222101', 'Logo sticker, chrome', 'Nos', 'V10050', 3.4, 3.43, 1500000],
    ['AC09222102', 'Logo sticker, silver', 'Nos', 'V10050', 2.8, 2.82, 1100000],
    ['AC09222103', 'Logo sticker, ODU', 'Nos', 'V10050', null, 1.7, 1300000],
  ],
  GO: [
    ['AC09223101', 'Escutcheon sticker, front panel', 'Nos', 'V10050', 4.2, 4.23, 1250000],
    ['AC09223102', 'Escutcheon sticker, WAC', 'Nos', 'V10050', 3.6, 3.63, 360000],
    ['AC09223103', 'Escutcheon sticker, inverter', 'Nos', 'V10050', 4.8, 4.84, 860000],
  ],
  GP: [
    ['AC09224101', 'BEE label 3-star', 'Nos', 'V10050', 1.6, 1.61, 1300000],
    ['AC09224102', 'BEE label 5-star', 'Nos', 'V10050', 1.6, 1.61, 1100000],
    ['AC09224103', 'BEE label, inverter', 'Nos', 'V10050', 1.8, 1.81, 900000],
  ],
  GZ: [
    ['AC09225101', 'Internal EPS, drain pan', 'Nos', 'V10053', 22, 22.18, 1200000],
    ['AC09225102', 'Internal EPS, condenser guard', 'Nos', 'V10053', 16, 16.13, 900000],
    ['AC09225103', 'Internal EPS, compressor block', 'Nos', 'V10053', 28, 28.22, 420000],
  ],
  BC: [
    ['AC11226101', 'Refrigerant R32, 9 kg cylinder', 'Nos', 'V10054', 5400, 5443, 46000],
    ['AC11226102', 'Refrigerant R410A, 11.3 kg cylinder', 'Nos', 'V10054', 8600, 8669, 21000],
    ['AC11226103', 'Refrigerant R134a, 13.6 kg cylinder', 'Nos', 'V10054', 7200, 7258, 9000],
  ],
  BQ: [
    ['AC11227101', 'Degreasing chemical, alkaline', 'Ltr', 'V10055', 86, 86.69, 120000],
    ['AC11227102', 'Phosphating chemical', 'Ltr', 'V10055', 142, 143, 84000],
    ['AC11227103', 'Fin cleaning solution', 'Ltr', 'V10055', 118, 119, 52000],
  ],
  BS: [
    ['AC11228101', 'Polyester powder coat, white', 'Kg', 'V10055', 236, 238, 260000],
    ['AC11228102', 'Epoxy powder coat, grey', 'Kg', 'V10055', 254, 256, 120000],
    ['AC11228103', 'Brazing flux powder', 'Kg', 'V10055', 612, 617, 16000],
  ],
  DY: [
    ['AC11229101', 'Refrigerant R32, bulk', 'Kg', 'V10054', 562, 566, 640000],
    ['AC11229102', 'Refrigerant R410A, bulk', 'Kg', 'V10054', 724, 730, 280000],
    ['AC11229103', 'Refrigerant R290, bulk', 'Kg', 'V10054', 1180, 1189, 36000],
  ],
  GB: [
    ['AC11230101', 'Sealing putty, grey', 'Kg', 'V10055', 84, 84.67, 140000],
    ['AC11230102', 'Drain pan sealant', 'Kg', 'V10055', 212, 214, 38000],
    ['AC11230103', 'Wall sleeve putty', 'Kg', 'V10055', 96, 96.77, 64000],
  ],
  BZ: [
    ['SP13231101', 'Proximity sensor, 12 mm', 'Nos', 'V10058', 1180, 1189, 1800],
    ['SP13231102', 'Contactor 32 A', 'Nos', 'V10058', 1460, 1472, 2400],
    ['SP13231103', 'MCB 16 A, 2-pole', 'Nos', 'V10058', 340, 343, 6200],
  ],
  DW: [
    ['SP13232101', 'Toughened glass panel 4 mm', 'Nos', 'V10059', 420, 423, 64000],
    ['SP13232102', 'Sight glass, vacuum station', 'Nos', 'V10059', 860, 867, 1200],
    ['SP13232103', 'Lab beaker set', 'Set', 'V10059', 1240, 1250, 240],
  ],
  O2: [
    ['SP13233101', 'Oxygen cylinder, 7 m³', 'Nos', 'V10054', 310, 312, 38000],
    ['SP13233102', 'Liquid oxygen, bulk', 'Kg', 'V10054', 24, 24.19, 420000],
    ['SP13233103', 'Oxygen manifold refill', 'Nos', 'V10054', 285, 287, 16000],
  ],
  N2: [
    ['SP13234101', 'Nitrogen gas cylinder, 7 m³', 'Nos', 'V10054', 480, 484, 42000],
    ['SP13234102', 'Liquid nitrogen, bulk', 'Kg', 'V10054', 18, 18.14, 980000],
    ['SP13234103', 'Nitrogen manifold refill', 'Nos', 'V10054', 430, 433, 14000],
  ],
  HEL: [
    ['SP13235101', 'Helium gas cylinder, 7 m³', 'Nos', 'V10054', 14200, 14314, 3200],
    ['SP13235102', 'Helium leak-test mix 10%', 'Nos', 'V10054', 4800, 4838, 2600],
    ['SP13235103', 'Helium recovery refill', 'Nos', 'V10054', 9600, 9677, 900],
  ],
  CO2: [
    ['SP13236101', 'CO2 gas cylinder, 30 kg', 'Nos', 'V10054', 1180, 1189, 9600],
    ['SP13236102', 'Liquid CO2, bulk', 'Kg', 'V10054', 16, 16.13, 120000],
    ['SP13236103', 'CO2 welding mix cylinder', 'Nos', 'V10054', 1640, 1653, 4200],
  ],
  PNO: [
    ['SP13237101', 'Punching oil, light grade', 'Ltr', 'V10055', 142, 143, 96000],
    ['SP13237102', 'Punching oil, evaporative', 'Ltr', 'V10055', 186, 187, 72000],
    ['SP13237103', 'Fin press oil', 'Ltr', 'V10055', 168, 169, 54000],
  ],
  LPG: [
    ['SP13238101', 'LPG cylinder, 19 kg', 'Nos', 'V10054', 1860, 1875, 8400],
    ['SP13238102', 'LPG cylinder, 47.5 kg', 'Nos', 'V10054', 4560, 4596, 5200],
    ['SP13238103', 'LPG, bulk', 'Kg', 'V10054', 78, 78.62, 140000],
  ],
  CO: [
    ['SP19239101', 'Injection mould, IDU front grill', 'Nos', 'V10056', 1850000, 1864800, 3],
    ['SP19239102', 'Progressive die, ODU bracket', 'Nos', 'V10056', 640000, 645120, 6],
    ['SP19239103', 'Fin die set, 7 mm', 'Set', 'V10056', 2400000, 2419200, 2],
  ],
  CZ: [
    ['SP19240101', 'Psychrometric calibration kit', 'Set', 'V10057', 420000, 423360, 4],
    ['SP19240102', 'Vacuum gauge, digital', 'Nos', 'V10057', 38000, 38304, 24],
    ['SP19240103', 'Refrigerant leak detector', 'Nos', 'V10057', 46000, 46368, 36],
  ],
  HF: [
    ['SP19241101', 'Die punch set, fin press', 'Set', 'V10056', 86000, 86688, 64],
    ['SP19241102', 'Mould core pin', 'Nos', 'V10056', null, 1200, 2400],
    ['SP19241103', 'Guide pillar and bush', 'Set', 'V10056', 4800, 4838, 420],
  ],
  HL: [
    ['SP19242101', 'Vacuum charging station', 'Nos', 'V10057', 1850000, 1864800, 6],
    ['SP19242102', 'Helium leak-test bench', 'Nos', 'V10057', 3200000, 3225600, 3],
    ['SP19242103', 'Pallet stacker, 1.5 t', 'Nos', 'V10057', 240000, 241920, 12],
  ],
  AA: [
    ['AC03021071', 'Aluminium fin stock 0.110 mm, hydrophobic', 'Kg', 'V10002', 309, 311, 900000],
  ],
  BW: [
    ['AC07090533', 'HIPS resin, white', 'Kg', 'V10017', 138, 139, 1800000],
  ],
  BP: [
    ['AC09100627', '3-ply carton, accessory kit', 'Nos', 'V10018', 24, 24.19, 1400000],
  ],
  AV: [
    ['AC09110729', 'EPS side pad, WAC', 'Set', 'V10019', 52, 52.42, 420000],
  ],
  BX: [
    ['SP15000829', 'LCV freight Noida → Rajpura, 14 ft', 'Trip', 'V10023', 24000, 24192, 2100],
  ],
  CM: [
    ['SP13000927', 'Gear oil EP 220, 20 L drum', 'Nos', 'V10024', 5200, 5242, 3200],
  ],
  CA: [
    ['SP13001023', 'Chilled water plant maintenance, Jhajjar', 'Month', 'V10025', 640000, 645120, 60],
  ],
}
