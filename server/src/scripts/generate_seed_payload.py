import openpyxl
import json
import re
import random
import hashlib

EXCEL_PATH = r"c:\Users\varun\OneDrive\Desktop\PAYPAL AI\agentmarket_40_company_product_dataset.xlsx"

PRODUCT_METADATA = {
    "Aluminium Desk": {
        "category": "Office Desks & Workstations",
        "base_price": 8500,
        "floor_ratio": 0.80,
        "material": "Extruded Anodized Aluminium & High-Density Engineered Wood Top",
        "lead_days": 6,
        "stock": 85,
        "specs": {
            "dimensions": "1200 x 600 x 750 mm",
            "frame": "Industrial Anodized Aluminium 6063-T6",
            "tabletop": "25mm Prelam Action TESA Board with 2mm PVC Edgeband",
            "cable_management": "Integrated Dual Cable Grommets",
            "warranty": "3 Years Comprehensive"
        }
    },
    "Classroom Chair": {
        "category": "Educational Seating",
        "base_price": 1450,
        "floor_ratio": 0.78,
        "material": "High-Impact Virgin Polypropylene Shell with Heavy MS Powder-Coated Legs",
        "lead_days": 4,
        "stock": 280,
        "specs": {
            "shell": "Virgin UV-Resistant Polypropylene (PP)",
            "frame": "19mm OD 16-Gauge Mild Steel Tubular Understructure",
            "stackable": True,
            "max_load": "135 kg",
            "warranty": "2 Years On-Site Replacement"
        }
    },
    "Executive Desk": {
        "category": "Executive & Managerial Workspaces",
        "base_price": 18500,
        "floor_ratio": 0.80,
        "material": "Grade-A Natural Teak Veneer / 36mm Melamine Board with Modesty Panel",
        "lead_days": 8,
        "stock": 45,
        "specs": {
            "dimensions": "1800 x 900 x 760 mm",
            "storage": "Attached 3-Drawer Lockable Mobile Pedestal with Central Keying",
            "finish": "Scratch-Resistant Polyurethane High-Gloss Matte Lacquer",
            "wire_channel": "Brushed Aluminium Flip-Top Wire Box with Power Sockets",
            "warranty": "5 Years Structural Warranty"
        }
    },
    "Folding Chair": {
        "category": "Event & Multipurpose Seating",
        "base_price": 950,
        "floor_ratio": 0.79,
        "material": "Epoxy Powder-Coated Tubular Steel with Cushioned Vinyl Foam Seat",
        "lead_days": 3,
        "stock": 350,
        "specs": {
            "frame": "22mm Cold-Rolled Mild Steel Tubing",
            "cushion": "High-Density PU Foam (32 kg/m3) with Spill-Proof Rexine",
            "fold_profile": "Compact 45mm flat folding for nested high-density storage",
            "weight": "3.6 kg",
            "warranty": "1 Year Commercial Use"
        }
    },
    "Kids Study Desk": {
        "category": "Educational & Children Furniture",
        "base_price": 3800,
        "floor_ratio": 0.80,
        "material": "Non-Toxic E1 Grade Engineered Board with Anti-Collision Soft Rounded PU Edges",
        "lead_days": 5,
        "stock": 110,
        "specs": {
            "dimensions": "800 x 500 x (550-750) mm Adjustable",
            "height_adjustable": True,
            "features": "Integrated Pen Groove, Bag Hook & Storage Shelf",
            "safety": "Zero-VOC Formaldehyde-Free Waterborne Coating",
            "warranty": "3 Years"
        }
    },
    "L-Shaped Sofa": {
        "category": "Lounge & Reception Seating",
        "base_price": 28000,
        "floor_ratio": 0.81,
        "material": "Seasoned Hardwood Sal/Pinewood Frame with 40D High-Resilience Foam & Breathable Suede",
        "lead_days": 11,
        "stock": 30,
        "specs": {
            "dimensions": "2400 x 1650 x 850 mm",
            "configuration": "Reversible Left or Right Modular Chaise",
            "spring_system": "High-Tensile S-Springs with Webbing Suspension",
            "upholstery": "Water-Repellent Anti-Stain Velvet/Suede 420 GSM",
            "warranty": "5 Years Internal Frame Warranty"
        }
    },
    "Lab Stool": {
        "category": "Laboratory & Industrial Seating",
        "base_price": 1850,
        "floor_ratio": 0.78,
        "material": "Chemical & Acid Resistant Molded Polyurethane Seat with Chrome Base",
        "lead_days": 4,
        "stock": 160,
        "specs": {
            "seat_diameter": "340 mm Molded Integral Skin Polyurethane",
            "height_range": "460 mm to 650 mm Pneumatic Class-3 Gas Lift",
            "footring": "Chrome-Plated Round Welded Foot Support Ring",
            "glides": "Heavy Duty Static Nylon Glides / Conductive Anti-Static Option",
            "warranty": "2 Years Replacement Warranty"
        }
    },
    "Office Desk": {
        "category": "Office Desks & Workstations",
        "base_price": 7200,
        "floor_ratio": 0.80,
        "material": "Heavy Duty 25mm Pre-Laminated Particle Board with Powder-Coated Metal C-Frame",
        "lead_days": 5,
        "stock": 90,
        "specs": {
            "dimensions": "1200 x 600 x 750 mm",
            "storage": "2-Drawer Lockable Fixed Unit with Smooth Telescopic Ball-Bearing Slides",
            "cable_management": "Dual 65mm Die-Cast Wire Grommets",
            "modesty_panel": "Full Height Metal Modesty Panel with Punch Hole Design",
            "warranty": "3 Years Commercial Warranty"
        }
    },
    "Recliner Sofa": {
        "category": "Lounge & Reception Seating",
        "base_price": 24500,
        "floor_ratio": 0.80,
        "material": "Heavy Duty German Mechanism with Kiln-Dried Pine Wood & Top-Grain Breathable Leatherette",
        "lead_days": 9,
        "stock": 35,
        "specs": {
            "dimensions": "950 x 920 x 1020 mm (Upright)",
            "recline_angle": "Up to 160° Multi-Position Locking",
            "mechanism": "Sturdy Alloy Steel Leggett & Platt Recline Actuator",
            "foam": "Ultra Plush Double Layered Pocket Spring + 38D Memory Foam",
            "warranty": "3 Years Mechanism & Frame"
        }
    },
    "School Desk": {
        "category": "Educational Furniture",
        "base_price": 2950,
        "floor_ratio": 0.79,
        "material": "Heavy Gauge ERW Steel Tube Framework with Post-Formed Laminated Dual Desk & Bench",
        "lead_days": 6,
        "stock": 240,
        "specs": {
            "type": "Integrated Dual Seater Student Desk & Attached Bench",
            "dimensions": "1050 x 850 x 750 mm",
            "shelf": "Heavy Steel Mesh Bottom Book Tray with Bag Hooks on both flanks",
            "edge": "Impact-Proof Injection-Molded Seamless PVC Edge",
            "warranty": "3 Years School Durability Guarantee"
        }
    },
    "Static Chair": {
        "category": "Office & Conference Seating",
        "base_price": 2100,
        "floor_ratio": 0.80,
        "material": "Ergonomic High-Tension Mesh Back with High-Density Molded Cushion & Cantilever Steel Base",
        "lead_days": 4,
        "stock": 180,
        "specs": {
            "backrest": "Breathable Korean Nylon Mesh with Built-in Lumbar Curve",
            "seat": "45D Polyurethane Injection Molded Foam with Anti-Sweat Fabric",
            "base": "Thick 25mm Diameter Chrome-Plated Cantilever Tubular Base",
            "armrest": "Fixed Ergonomic Polypropylene Armrests",
            "warranty": "2 Years Comprehensive"
        }
    },
    "Steel Almirah": {
        "category": "Storage & Filing Systems",
        "base_price": 11500,
        "floor_ratio": 0.80,
        "material": "CRCA Prime Steel (20/22 Gauge) with Automated 7-Tank Pretreatment & Epoxy Powder Coat",
        "lead_days": 7,
        "stock": 60,
        "specs": {
            "dimensions": "1980 x 915 x 485 mm",
            "shelves": "4 Fully Height-Adjustable Shelves + 1 Integrated Key-Locking Locker Box",
            "locking": "Triple Action High-Security Deadbolt Brass Locking with Duplicate Keys",
            "load_capacity": "50 kg Uniform Distributed Load per shelf",
            "warranty": "10 Years Anti-Rust Guarantee"
        }
    },
    "Storage Cabinet": {
        "category": "Storage & Filing Systems",
        "base_price": 6500,
        "floor_ratio": 0.80,
        "material": "Commercial Melamine-Faced Chipboard (MFC) with Dual Lockable Hinged Doors",
        "lead_days": 5,
        "stock": 75,
        "specs": {
            "dimensions": "1200 x 800 x 400 mm",
            "capacity": "Holds up to 36 Heavy Box Arch Binder Files",
            "hardware": "Hafele/Hettich Soft-Closing Hinges & Zinc Alloy Handles",
            "leveling": "4 Heavy Duty Adjustable Leveling Screws for Uneven Floors",
            "warranty": "3 Years Commercial Warranty"
        }
    },
    "Study Table": {
        "category": "Educational & Home Study",
        "base_price": 4200,
        "floor_ratio": 0.80,
        "material": "High-Grade Engineered Board with Dual-Tone Oak/Frosty White Finish",
        "lead_days": 4,
        "stock": 130,
        "specs": {
            "dimensions": "1000 x 500 x 750 mm (Desk) + 400mm Upper Book Organizer",
            "storage": "2-Tier Book Shelf, Top Stationer Cubby, Bottom CPU/Footrest Tray",
            "finish": "Thermostatically Pressed Anti-Scratch Melamine",
            "warranty": "2 Years Domestic & Academic Warranty"
        }
    },
    "Visitor Chair": {
        "category": "Office & Conference Seating",
        "base_price": 2800,
        "floor_ratio": 0.79,
        "material": "Heavy Electroplated Chrome Sledge Base with Lumbar Supported Mesh Back",
        "lead_days": 4,
        "stock": 140,
        "specs": {
            "structure": "Continuous Ergonomic Chrome S-Base with Anti-Tilt Nylon Floor Gliders",
            "cushion": "50mm Thickness 40D High-Resilience Virgin Foam",
            "lumbar": "Dynamic Elastic Lower Spine Contouring",
            "stackable": False,
            "warranty": "2 Years Replacement Warranty"
        }
    },
    "Wheel Chair": {
        "category": "Ergonomic Task Seating",
        "base_price": 5400,
        "floor_ratio": 0.80,
        "material": "Reinforced Glass-Filled Nylon Body with BIFMA Class-4 Gas Cylinder & Silent PU Castors",
        "lead_days": 4,
        "stock": 115,
        "specs": {
            "mechanism": "Synchro-Tilt with Multi-Position Lock & Tension Regulator",
            "arms": "Height Adjustable 2D Polyurethane Soft-Touch Arm Pads",
            "gas_lift": "BIFMA X5.1 Certified 120mm Class-4 Heavy Duty Pneumatic Piston",
            "castors": "Twin 60mm Noise-Free Anti-Scratch PU Caster Wheels",
            "warranty": "3 Years Comprehensive Warranty"
        }
    },
    "Workstation Desk": {
        "category": "Office Desks & Workstations",
        "base_price": 12800,
        "floor_ratio": 0.80,
        "material": "Modular Extruded Aluminium Tile Raceway Structure with 25mm Postformed Particle Board",
        "lead_days": 7,
        "stock": 55,
        "specs": {
            "dimensions": "1200 x 1200 x 1050 mm",
            "privacy_screen": "Acoustic Fabric Pin-up and Marker Glass Tile Partition",
            "wire_ducting": "Dual Below-Desk Separated Raceways for High-Voltage & Data Cabling",
            "pedestal": "Optional 3-Drawer Lockable Mobile Metal Pedestal Included",
            "warranty": "5 Years Corporate Warranty"
        }
    }
}

def slugify(text):
    text = re.sub(r"[^a-zA-Z0-9]+", "", text).lower()
    return text[:12]

def generate_gstin(name, idx):
    state_code = "29" # Karnataka / Tech & Commercial Hub
    chars = re.sub(r"[^A-Z]", "", name.upper()) + "ABCDEFGHIJ"
    pan = f"{chars[:5]}{1000 + idx}F"
    return f"{state_code}{pan}1Z{idx % 10}"

def generate_reg_no(name, idx):
    prefix = re.sub(r"[^A-Z]", "", name.upper())[:4].ljust(4, "X")
    return f"REG-{prefix}-{2020 + (idx % 5)}"

def main():
    wb = openpyxl.load_workbook(EXCEL_PATH)
    
    # 1. Parse Companies
    comp_sheet = wb['Companies Overview']
    companies = []
    
    for r in range(2, comp_sheet.max_row + 1):
        cname = comp_sheet.cell(row=r, column=1).value
        if not cname or not str(cname).strip():
            continue
        cname = str(cname).strip()
        companies.append(cname)
        
    print(f"Discovered {len(companies)} companies in Overview sheet.")
    
    # 2. Build Business Profiles
    # Special rule: "Varun Furni" must connect to "22et0003@gmail.com"
    businesses = []
    biz_name_to_id = {}
    biz_name_to_email = {}
    
    for idx, name in enumerate(companies, start=1):
        slug = slugify(name)
        # Deterministic ID for repeat stability
        biz_id = hashlib.md5(f"biz_{name}".encode("utf-8")).hexdigest()
        # Format as UUID
        biz_uuid = f"{biz_id[:8]}-{biz_id[8:12]}-{biz_id[12:16]}-{biz_id[16:20]}-{biz_id[20:32]}"
        
        if name.lower() == "varun furni":
            email = "22et0003@gmail.com"
            category = "Commercial & Institutional Furniture"
            reg_no = "REG-VARU-2024"
            gstin = "29AABCV2003F1Z1"
        else:
            email = f"sales@{slug}.in"
            category = "Commercial & Office Furniture Systems"
            reg_no = generate_reg_no(name, idx)
            gstin = generate_gstin(name, idx)
            
        biz_record = {
            "id": biz_uuid,
            "name": name,
            "email": email,
            "category": category,
            "reg_no": reg_no,
            "gstin": gstin,
            "is_verified": True
        }
        businesses.append(biz_record)
        biz_name_to_id[name.lower()] = biz_uuid
        biz_name_to_email[name.lower()] = email

    # 3. Parse Products Catalog
    prod_sheet = wb['Product Catalog']
    products = []
    used_skus = set()
    
    for r in range(2, prod_sheet.max_row + 1):
        cname = prod_sheet.cell(row=r, column=1).value
        pname = prod_sheet.cell(row=r, column=2).value
        raw_sku = prod_sheet.cell(row=r, column=3).value
        
        if not cname or not pname:
            continue
            
        cname = str(cname).strip()
        pname = str(pname).strip()
        raw_sku = str(raw_sku).strip() if raw_sku else ""
        
        biz_id = biz_name_to_id.get(cname.lower())
        if not biz_id:
            print(f"Warning: Business '{cname}' not found in companies list!")
            continue
            
        meta = PRODUCT_METADATA.get(pname)
        if not meta:
            # Fallback for unknown product
            meta = {
                "category": "Office Furniture & Supplies",
                "base_price": 5000,
                "floor_ratio": 0.80,
                "material": "Standard Commercial Materials",
                "lead_days": 5,
                "stock": 100,
                "specs": {"type": pname}
            }
            
        # Give a realistic 2-5% price variance per company so bids vary slightly across suppliers
        seed_num = int(hashlib.md5(f"{cname}_{pname}".encode("utf-8")).hexdigest()[:6], 16)
        variance_pct = ((seed_num % 15) - 7) / 100.0 # -7% to +7%
        base_price = round(meta["base_price"] * (1.0 + variance_pct) / 50.0) * 50
        floor_price = round(base_price * meta["floor_ratio"] / 50.0) * 50
        
        stock_variance = (seed_num % 40) - 20
        stock = max(25, meta["stock"] + stock_variance)
        
        lead_variance = (seed_num % 3) - 1
        lead_days = max(2, meta["lead_days"] + lead_variance)
        
        # Ensure unique SKU
        base_sku = raw_sku if raw_sku else f"{slugify(cname)[:4].upper()}-{slugify(pname)[:5].upper()}"
        sku = base_sku
        counter = 1
        while sku in used_skus:
            counter += 1
            sku = f"{base_sku}-{counter:02d}"
        used_skus.add(sku)
        
        # Unique deterministic product UUID
        prod_id_raw = hashlib.md5(f"prod_{cname}_{pname}_{sku}".encode("utf-8")).hexdigest()
        prod_uuid = f"{prod_id_raw[:8]}-{prod_id_raw[8:12]}-{prod_id_raw[12:16]}-{prod_id_raw[16:20]}-{prod_id_raw[20:32]}"
        
        on_time_rate = 94 + (seed_num % 6) # 94% to 99%
        
        prod_record = {
            "id": prod_uuid,
            "business_id": biz_id,
            "name": pname,
            "sku": sku,
            "category": meta["category"],
            "base_price": base_price,
            "floor_price": floor_price,
            "in_stock": stock,
            "lead_days": lead_days,
            "material": meta["material"],
            "specs": meta["specs"],
            "on_time_rate": on_time_rate,
            "is_active": True
        }
        products.append(prod_record)
        
    print(f"Generated {len(products)} products across {len(businesses)} businesses.")
    
    # 4. Generate Agent Configs (1 per business)
    agent_configs = []
    for b in businesses:
        cfg_raw = hashlib.md5(f"cfg_{b['id']}".encode("utf-8")).hexdigest()
        cfg_uuid = f"{cfg_raw[:8]}-{cfg_raw[8:12]}-{cfg_raw[12:16]}-{cfg_raw[16:20]}-{cfg_raw[20:32]}"
        agent_configs.append({
            "id": cfg_uuid,
            "business_id": b["id"],
            "auto_quote": True,
            "min_margin": 18,
            "max_round_concession": 5,
            "require_approval_above": 100000
        })
        
    output_data = {
        "businesses": businesses,
        "supplier_products": products,
        "agent_configs": agent_configs
    }
    
    out_file = r"c:\Users\varun\OneDrive\Desktop\PAYPAL AI\server\src\scripts\seed_payload.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Successfully saved seed payload to: {out_file}")
    
    # Verify Varun Furni record
    vf = next((b for b in businesses if "varun" in b["name"].lower()), None)
    print("\nVarun Furni Business Record:")
    print(json.dumps(vf, indent=2))
    
    vf_prods = [p for p in products if p["business_id"] == vf["id"]]
    print(f"\nVarun Furni Catalog Products ({len(vf_prods)}):")
    for p in vf_prods:
        print(f" - {p['sku']}: {p['name']} | Base: INR {p['base_price']} | Floor: INR {p['floor_price']} | Stock: {p['in_stock']} | Category: {p['category']}")

if __name__ == "__main__":
    main()
