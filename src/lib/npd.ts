// NPD development master — imported from the VMS (Vendor Management System) extract "npd data.xlsx".
// Read-only in COIN: commodity codes, development SPOCs per plant / product line, testing schedule and DQA SPOC.
// Generated from the workbook; edit in VMS, not here.

export interface NpdSpoc { corporate?: string; racRajpura?: string; racJhajjar?: string; racSricity?: string; gradeARajpura?: string; cacRajpura?: string; waterDispenser?: string; airPurifier?: string; specialProjects?: string; dqa?: string }
export interface NpdCommodity { code: string; name: string; perfDays: number | null; relDays: number | null; spoc: NpdSpoc }
export interface VendorGroup { code: string; name: string; kind: 'Domestic' | 'Import' }

export const NPD_SOURCE = { system: 'VMS', file: 'npd data.xlsx', syncedAt: '2026-10-01T06:30:00' }

/** Development SPOC columns, in the workbook's order */
export const NPD_SPOC_COLUMNS: { key: keyof NpdSpoc; label: string; group: string; plant: string }[] = [
  { key: 'corporate', label: 'Sourcing Corporate', group: 'Development SPOC', plant: 'Corporate' },
  { key: 'racRajpura', label: 'RAC / CAC', group: 'Development SPOC', plant: 'Rajpura' },
  { key: 'racJhajjar', label: 'RAC / CAC', group: 'Development SPOC', plant: 'Jhajjar' },
  { key: 'racSricity', label: 'RAC / CAC', group: 'Development SPOC', plant: 'Sri City' },
  { key: 'gradeARajpura', label: 'Grade A', group: 'Development SPOC', plant: 'Rajpura' },
  { key: 'cacRajpura', label: 'CAC', group: 'Development SPOC', plant: 'Rajpura' },
  { key: 'waterDispenser', label: 'Water Dispenser', group: 'Development SPOC', plant: 'Rajpura' },
  { key: 'airPurifier', label: 'Air Purifier', group: 'Development SPOC', plant: 'Rajpura' },
  { key: 'specialProjects', label: 'Special Projects', group: 'Development SPOC', plant: 'All plants' },
  { key: 'dqa', label: 'DQA', group: 'DQA', plant: 'All plants' },
]

export const NPD_COMMODITIES: NpdCommodity[] = [
{
"code": "AA",
"name": "Aluminium",
"perfDays": 60,
"relDays": 60,
"spoc": {
"corporate": "Shubham Verma",
"racRajpura": "Satbir Singh",
"racJhajjar": "Sahil Bansal",
"racSricity": "Kartikiyan",
"gradeARajpura": "Amarjeet Singh",
"cacRajpura": "Piyush",
"specialProjects": "Sohit",
"dqa": "Sanjeev"
}
},
{
"code": "AB",
"name": "FG-Extruded Sheet",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AC",
"name": "FG-HE Coil",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AD",
"name": "FG-IDU",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AE",
"name": "FG-Inner Case",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AF",
"name": "FG-MFC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AG",
"name": "FG-ODU",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AH",
"name": "FG-PLC",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "AI",
"name": "FG-SMC",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "AJ",
"name": "Steel",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rohit Gandhi"
}
},
{
"code": "AK",
"name": "FG-WAC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AL",
"name": "FG-ODU Kit",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AM",
"name": "FG-SAC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AN",
"name": "ODU-Accessories",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AO",
"name": "Compressor",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "AP",
"name": "Motor",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "AQ",
"name": "RM-IDU",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AR",
"name": "RM-HE Coil",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "AS",
"name": "Sticker & Label",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "AT",
"name": "Remote",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "AU",
"name": "Foam",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "AV",
"name": "EPS",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "AX",
"name": "Brass Parts",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "AY",
"name": "Capacitor",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "AZ",
"name": "Cross Flow Fan",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "BA",
"name": "FG-Portable AC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "BB",
"name": "Fan",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "BC",
"name": "Gas",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "BD",
"name": "Hardware",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "BE",
"name": "Ink",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "BF",
"name": "Poly Bag",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "BG",
"name": "Rear Grill",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "BH",
"name": "Hardware Other",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "BI",
"name": "Rubber Parts",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "BJ",
"name": "Service Valve",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "BK",
"name": "Tape",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "BL",
"name": "Wire",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "BM",
"name": "FG-PP Roll",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "BN",
"name": "Bolt",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "BO",
"name": "Brazing Rod",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "BP",
"name": "Carton Box",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "BQ",
"name": "Chemical",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "BR",
"name": "FG-Copper Tubing",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "BS",
"name": "Powder",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "BT",
"name": "Terminal Block",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "BU",
"name": "Packing Material",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "BV",
"name": "Copper Tube",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "BW",
"name": "Plastic Granules",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "BX",
"name": "General",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "BY",
"name": "Printing & Stationery",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "BZ",
"name": "Electrical & Electronics Store & Spares",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "CA",
"name": "Mechanical",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "CB",
"name": "Plastic Grinding",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "CM",
"name": "Oil & Lubricants",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "CO",
"name": "Tools & Die",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Raghuvendra"
}
},
{
"code": "CP",
"name": "SKD Assembly",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "CT",
"name": "EPS Assembly",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "CU",
"name": "FG-WAC Kit",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "CV",
"name": "Controller",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "CW",
"name": "Display PCB",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "CX",
"name": "Blower",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "CZ",
"name": "Lab Equipments",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "DA",
"name": "FG-IDU Dummy",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DB",
"name": "Brazing Ring-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "DC",
"name": "SCRAP",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DG",
"name": "RM-Aluminium",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "DH",
"name": "RM-ODU",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DI",
"name": "RM-WAC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DJ",
"name": "FG-Aluminium Components",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DK",
"name": "RM-MFC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DN",
"name": "FG-ODU Dummy",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DO",
"name": "FG-SAC Dummy",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DP",
"name": "Capillary Tube",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "DR",
"name": "Louver/Stepping Motor",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "DS",
"name": "FG-IDU Kit",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DT",
"name": "Main PCB",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "DU",
"name": "FG-CAC",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "DV",
"name": "Master Batch",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "DW",
"name": "Glass",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "DX",
"name": "PCB",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "DY",
"name": "Gas AC",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "DZ",
"name": "Compressor-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "EA",
"name": "Compressor-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "EB",
"name": "Controller IDU-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EC",
"name": "Controller ODU-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "ED",
"name": "Controller WAC-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EF",
"name": "Controller IDU",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EG",
"name": "Controller IDU-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EH",
"name": "Controller ODU-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EI",
"name": "Controller WAC-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EJ",
"name": "Controller WAC",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EK",
"name": "Copper Part RM-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "EL",
"name": "FG-Electrical And Electronics Parts",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "EM",
"name": "Copper Tube-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "EN",
"name": "Copper Capillary Tube RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "EO",
"name": "Copper Capillary Tube BOP",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "EQ",
"name": "Display PCB IDU-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "ER",
"name": "Electrical And Electronics Parts RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "ES",
"name": "Display PCB IDU",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "ET",
"name": "Display PCB IDU-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EU",
"name": "Display PCB WAC-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EV",
"name": "Display PCB WAC",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Satya Vijay"
}
},
{
"code": "EW",
"name": "Electrical And Electronics Parts RM-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "EX",
"name": "Electrical And Electronics Parts RM-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "EY",
"name": "Remote-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "EZ",
"name": "Remote-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "FA",
"name": "Sleeve",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "FB",
"name": "Insulation Tube",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "FC",
"name": "Jacket",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Manish Kumar"
}
},
{
"code": "FE",
"name": "Rubber Part RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "FF",
"name": "Aluminium Parts RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FG",
"name": "Copper Part RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FI",
"name": "Plastic Part RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FJ",
"name": "Sheet Metal Part RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FK",
"name": "Motor-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "FL",
"name": "Filter",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FM",
"name": "Wire-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "FO",
"name": "Aluminium Strip-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "FP",
"name": "Aluminium Brazing Filler-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "FQ",
"name": "Aluminium Pipe-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "FR",
"name": "Aluminium Foil-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "FS",
"name": "Brass Part-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "FT",
"name": "Brazing Rod-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "FU",
"name": "Cross Flow Fan-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "FV",
"name": "Moulding RM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "FW",
"name": "Louver/Stepping Motor-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "FX",
"name": "Motor-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Ashutosh Sharma"
}
},
{
"code": "FY",
"name": "Plastic Part RM-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "FZ",
"name": "Service Valve-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "GA",
"name": "Battery",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "GB",
"name": "Putty",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "GD",
"name": "Edge Angle",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GE",
"name": "Corrugated Separator",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GF",
"name": "P.P Band",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "GG",
"name": "Staple Pin",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "GH",
"name": "Wiring Diagram Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GI",
"name": "Strip Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GJ",
"name": "SOWM Label",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GK",
"name": "Ribbon",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GL",
"name": "Rating Label Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GM",
"name": "Manual",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GN",
"name": "Logo Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GO",
"name": "Escutcheon Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GP",
"name": "BEE Label Sticker",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Pallav Roy"
}
},
{
"code": "GR",
"name": "IDU Front Grill",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "GS",
"name": "ODU Fan Guard",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "GT",
"name": "IDU Drain Hose",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "GU",
"name": "WAC Front Grill",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "GV",
"name": "Master Batch-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "GW",
"name": "Plastic Granules-Cust",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Sandeep Agarwal"
}
},
{
"code": "GY",
"name": "Aluminium Foil-Local",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "GZ",
"name": "Internal EPS",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Rakesh Kumar"
}
},
{
"code": "HA",
"name": "Copper Tube Plain Domestic",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "HB",
"name": "Copper Tube IGT Domestic",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "HC",
"name": "Copper Tube Plain-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "HD",
"name": "Copper Tube IGT-Imp",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "HE",
"name": "Copper Capillary Tube",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Shubham Verma"
}
},
{
"code": "HF",
"name": "Tool & Die Parts",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Raghuvendra"
}
},
{
"code": "HG",
"name": "Robotic System",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "HI",
"name": "Iljin Parts",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "HJ",
"name": "QMD IDU Kit",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "HK",
"name": "QMD ODU Kit",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "NA",
"name": "NA for Other vendors",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "HL",
"name": "Fixed Asset",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Abhishek Sharma"
}
},
{
"code": "SV",
"name": "Service",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "HM",
"name": "Job Work",
"perfDays": null,
"relDays": null,
"spoc": {}
},
{
"code": "",
"name": "O2",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "",
"name": "N2",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "",
"name": "HELIUM",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "",
"name": "CO2",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "",
"name": "PUNCHING OIL",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
},
{
"code": "",
"name": "LPG",
"perfDays": null,
"relDays": null,
"spoc": {
"corporate": "Karan Nanda"
}
}
]

export const VENDOR_GROUPS: VendorGroup[] = [
{
"code": "CR-AGT",
"name": "Creditors Agents",
"kind": "Domestic"
},
{
"code": "CR-BANK",
"name": "Creditors Bank",
"kind": "Domestic"
},
{
"code": "CR-CAP",
"name": "Creditors Capex",
"kind": "Domestic"
},
{
"code": "CR-CO",
"name": "Creditors Consumable",
"kind": "Domestic"
},
{
"code": "CR-EX",
"name": "Creditors Expense",
"kind": "Domestic"
},
{
"code": "CR-INT",
"name": "Creditors Inter Unit",
"kind": "Domestic"
},
{
"code": "CR-JW",
"name": "Creditors Job work",
"kind": "Domestic"
},
{
"code": "CR-KMP",
"name": "Creditors Key Management Persons",
"kind": "Domestic"
},
{
"code": "CR-PK",
"name": "Creditors Packing Material",
"kind": "Domestic"
},
{
"code": "CR-RM",
"name": "Creditors Raw Material",
"kind": "Domestic"
},
{
"code": "CR-RPT",
"name": "Creditors Related Parties",
"kind": "Domestic"
},
{
"code": "CR-SC",
"name": "Creditors Sister Concern",
"kind": "Domestic"
},
{
"code": "CR-STAT",
"name": "Creditors Staturoty",
"kind": "Domestic"
},
{
"code": "CR-TPT",
"name": "Creditors Transporter",
"kind": "Domestic"
},
{
"code": "CR-IMP",
"name": "Creditors Imports Raw Material",
"kind": "Import"
},
{
"code": "CR-IMP-CAP",
"name": "Creditors Import Capex",
"kind": "Import"
},
{
"code": "CR-IMP-EXP",
"name": "Creditors Import Expense",
"kind": "Import"
},
{
"code": "CR-IMP-SER",
"name": "Creditors Import Service",
"kind": "Import"
}
]

export const PAYMENT_METHODS: string[] = ["By Cheque", "LC", "NEFT/RTGS", "PDC", "TT"]
