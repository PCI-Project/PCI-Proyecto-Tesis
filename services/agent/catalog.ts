// Copia de respaldo de los catálogos del agente.
export const catalog = {
  "treatments": {
    "monitoreo": {
      "tipo": "tratamiento",
      "nombre": "Sin intervención, reinspeccionar",
      "nombre_en": "Do nothing / monitor",
      "nivel": "Mantenimiento preventivo",
      "unidad": "global",
      "equipo": [],
      "vida_util_anios": 1,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 0
      },
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [],
      "adicionales_rural": []
    },
    "sellado_grietas": {
      "tipo": "ambos",
      "nombre": "Sellado y relleno de grietas",
      "nombre_en": "Crack sealing / crack filling",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m",
      "equipo": [
        "Compresor o lanza de aire caliente (limpieza)",
        "Fundidor-aplicador de sellante",
        "Ruteadora (opcional)"
      ],
      "vida_util_anios": 3,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 3
      },
      "previos": [
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [],
      "adicionales_rural": [],
      "nota": "Grietas L (< 10 mm) y M (10–75 mm). Las H (> 75 mm) no se sellan: se parchean."
    },
    "fog_seal": {
      "tipo": "tratamiento",
      "nombre": "Riego de niebla (emulsión diluida)",
      "nombre_en": "Fog seal",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Distribuidor de asfalto",
        "Barredora"
      ],
      "vida_util_anios": 2,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 4
      },
      "trafico_max": "medio",
      "no_aplicar_si": {
        "2": [
          "M",
          "H"
        ]
      },
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": [],
      "nota": "Reduce la fricción unas horas o días: cerrar o controlar el tránsito."
    },
    "rejuvenecedor": {
      "tipo": "tratamiento",
      "nombre": "Rejuvenecedor",
      "nombre_en": "Rejuvenator",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Distribuidor de asfalto",
        "Barredora"
      ],
      "vida_util_anios": 3,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 5
      },
      "trafico_max": "medio",
      "no_aplicar_si": {
        "2": [
          "L",
          "M",
          "H"
        ]
      },
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": []
    },
    "sand_seal": {
      "tipo": "tratamiento",
      "nombre": "Sello de arena",
      "nombre_en": "Sand seal",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Distribuidor de asfalto",
        "Esparcidora de agregado",
        "Rodillo neumático",
        "Barredora"
      ],
      "vida_util_anios": 3,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 6
      },
      "trafico_max": "bajo",
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": []
    },
    "chip_seal": {
      "tipo": "tratamiento",
      "nombre": "Tratamiento superficial con gravilla",
      "nombre_en": "Chip seal",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Distribuidor de asfalto",
        "Esparcidora de agregado",
        "Rodillo neumático",
        "Barredora"
      ],
      "vida_util_anios": 6,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 10
      },
      "trafico_max": "medio",
      "no_aplicar_si": {
        "2": [
          "M",
          "H"
        ]
      },
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": [],
      "nota": "En vía urbana el agregado suelto molesta a peatones y daña vehículos: barrer a las 24–48 h."
    },
    "slurry_seal": {
      "tipo": "tratamiento",
      "nombre": "Lechada asfáltica",
      "nombre_en": "Slurry seal",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Mezcladora-extendedora de lechada",
        "Barredora"
      ],
      "vida_util_anios": 4,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 8
      },
      "trafico_max": "medio",
      "no_aplicar_si": {
        "15": [
          "M",
          "H"
        ]
      },
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": []
    },
    "micropavimento": {
      "tipo": "tratamiento",
      "nombre": "Micropavimento",
      "nombre_en": "Micro-surfacing",
      "nivel": "Mantenimiento preventivo",
      "unidad": "m2",
      "equipo": [
        "Mezcladora-extendedora de micropavimento",
        "Caja de relleno de roderas (opcional)",
        "Barredora"
      ],
      "vida_util_anios": 6,
      "pci_resultante": {
        "tipo": "suma",
        "valor": 12
      },
      "trafico_max": "alto",
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie"
      ],
      "adicionales_rural": [],
      "nota": "Rellena roderas de hasta ~25 mm con caja de relleno: absorbe el relleno de roderas."
    },
    "thin_overlay": {
      "tipo": "tratamiento",
      "nombre": "Sobrecapa delgada (≤ 40 mm)",
      "nombre_en": "Thin overlay",
      "nivel": "Rehabilitación menor",
      "unidad": "m2",
      "equipo": [
        "Planta de mezcla en caliente (o proveedor)",
        "Pavimentadora",
        "Rodillo liso",
        "Rodillo neumático",
        "Distribuidor de asfalto (riego de liga)"
      ],
      "vida_util_anios": 8,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 95
      },
      "requiere_bordillo_min_cm": 7.6,
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "arenado_exudacion",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie",
        "riego_liga"
      ],
      "adicionales_rural": [
        "conformacion_hombros"
      ],
      "fuente": "MS-16 4.ª ed. 2009, Tabla 1.1 p. 14 (PCI 50–70 con bordillo > 3 in)"
    },
    "mill_and_replace": {
      "tipo": "tratamiento",
      "nombre": "Fresado y reposición",
      "nombre_en": "Mill and replace (mill and inlay)",
      "nivel": "Rehabilitación menor",
      "unidad": "m2",
      "equipo": [
        "Fresadora",
        "Planta de mezcla en caliente (o proveedor)",
        "Pavimentadora",
        "Rodillo liso",
        "Rodillo neumático",
        "Distribuidor de asfalto (riego de liga)",
        "Volquetes"
      ],
      "vida_util_anios": 10,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 95
      },
      "previos": [
        "parcheo_profundidad_total",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "riego_liga"
      ],
      "adicionales_rural": [],
      "fuente": "MS-16 4.ª ed. 2009, Tabla 1.1 p. 14 (PCI 50–70 con bordillo < 3 in)"
    },
    "sobrecapa_estructural": {
      "tipo": "tratamiento",
      "nombre": "Sobrecapa estructural",
      "nombre_en": "Structural overlay",
      "nivel": "Rehabilitación mayor",
      "unidad": "m2",
      "equipo": [
        "Planta de mezcla en caliente (o proveedor)",
        "Pavimentadora",
        "Rodillo liso",
        "Rodillo neumático",
        "Distribuidor de asfalto (riego de liga)"
      ],
      "vida_util_anios": 12,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 98
      },
      "requiere_bordillo_min_cm": 7.6,
      "previos": [
        "sellado_grietas",
        "parcheo_profundidad_parcial",
        "parcheo_profundidad_total",
        "parcheo_superficial",
        "fresado_local",
        "relleno_roderas",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "limpieza_superficie",
        "riego_liga"
      ],
      "adicionales_rural": [
        "conformacion_hombros"
      ],
      "fuente": "MS-16 4.ª ed. 2009, Tabla 1.1 p. 14 (PCI < 50); espesor según MS-17"
    },
    "fresado_sobrecapa_estructural": {
      "tipo": "tratamiento",
      "nombre": "Fresado y sobrecapa estructural",
      "nombre_en": "Mill and structural overlay",
      "nivel": "Rehabilitación mayor",
      "unidad": "m2",
      "equipo": [
        "Fresadora",
        "Planta de mezcla en caliente (o proveedor)",
        "Pavimentadora",
        "Rodillo liso",
        "Rodillo neumático",
        "Distribuidor de asfalto (riego de liga)",
        "Volquetes"
      ],
      "vida_util_anios": 12,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 98
      },
      "previos": [
        "parcheo_profundidad_total",
        "nivelacion_hombros"
      ],
      "adicionales": [
        "riego_liga"
      ],
      "adicionales_rural": [
        "conformacion_hombros"
      ],
      "fuente": "Regla del agente: estructural donde el bordillo no deja subir la rasante; espesor según MS-17"
    },
    "fdr": {
      "tipo": "tratamiento",
      "nombre": "Recuperación a profundidad total",
      "nombre_en": "Full-depth reclamation (FDR)",
      "nivel": "Rehabilitación mayor",
      "unidad": "m2",
      "equipo": [
        "Recicladora-estabilizadora",
        "Distribuidor de cemento o emulsión",
        "Motoniveladora",
        "Rodillo pata de cabra",
        "Rodillo liso",
        "Pavimentadora"
      ],
      "vida_util_anios": 15,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 100
      },
      "previos": [
        "nivelacion_hombros"
      ],
      "adicionales": [],
      "adicionales_rural": [
        "conformacion_hombros"
      ],
      "fuente": "Haas 2015, Tabla 17.1 (por verificar); diseño según MS-4 / MS-22"
    },
    "reconstruccion": {
      "tipo": "tratamiento",
      "nombre": "Reconstrucción completa",
      "nombre_en": "Full reconstruction",
      "nivel": "Reconstrucción",
      "unidad": "m2",
      "equipo": [
        "Excavadora",
        "Volquetes",
        "Motoniveladora",
        "Rodillos",
        "Planta de mezcla en caliente (o proveedor)",
        "Pavimentadora"
      ],
      "vida_util_anios": 20,
      "pci_resultante": {
        "tipo": "fijo",
        "valor": 100
      },
      "previos": [],
      "adicionales": [],
      "adicionales_rural": [
        "conformacion_hombros"
      ],
      "fuente": "Fuera del alcance del MS-16; diseño según MS-4 y MS-22"
    },
    "limpieza_superficie": {
      "tipo": "actividad",
      "nombre": "Barrido y limpieza de la superficie",
      "nombre_en": "Surface cleaning",
      "unidad": "m2",
      "equipo": [
        "Barredora o compresor"
      ]
    },
    "riego_liga": {
      "tipo": "actividad",
      "nombre": "Riego de liga",
      "nombre_en": "Tack coat",
      "unidad": "m2",
      "equipo": [
        "Distribuidor de asfalto"
      ]
    },
    "parcheo_profundidad_parcial": {
      "tipo": "actividad",
      "nombre": "Parcheo a profundidad parcial",
      "nombre_en": "Partial-depth patching",
      "unidad": "m2",
      "equipo": [
        "Cortadora o fresadora pequeña",
        "Compactador de placa o rodillo pequeño",
        "Mezcla en caliente o en frío"
      ]
    },
    "parcheo_profundidad_total": {
      "tipo": "actividad",
      "nombre": "Parcheo a profundidad total",
      "nombre_en": "Full-depth patching",
      "unidad": "m2",
      "equipo": [
        "Cortadora",
        "Retroexcavadora o equipo de excavación",
        "Compactador",
        "Mezcla en caliente"
      ]
    },
    "parcheo_superficial": {
      "tipo": "actividad",
      "nombre": "Parcheo superficial / nivelación de depresiones",
      "nombre_en": "Skin patching / leveling",
      "unidad": "m2",
      "equipo": [
        "Rodillo pequeño",
        "Mezcla en caliente"
      ]
    },
    "fresado_local": {
      "tipo": "actividad",
      "nombre": "Fresado localizado y reposición",
      "nombre_en": "Spot milling",
      "unidad": "m2",
      "equipo": [
        "Fresadora",
        "Rodillo pequeño",
        "Mezcla en caliente"
      ]
    },
    "arenado_exudacion": {
      "tipo": "actividad",
      "nombre": "Arenado de la exudación",
      "nombre_en": "Sanding of bleeding areas",
      "unidad": "m2",
      "equipo": [
        "Esparcidora de arena",
        "Rodillo neumático"
      ]
    },
    "relleno_roderas": {
      "tipo": "actividad",
      "nombre": "Relleno de roderas",
      "nombre_en": "Rut filling",
      "unidad": "m2",
      "equipo": [
        "Mezcladora de micropavimento con caja de roderas, o pavimentadora"
      ]
    },
    "nivelacion_hombros": {
      "tipo": "actividad",
      "nombre": "Nivelación de hombros (desnivel carril/berma)",
      "nombre_en": "Shoulder leveling",
      "unidad": "m",
      "equipo": [
        "Motoniveladora",
        "Compactador",
        "Material granular"
      ]
    },
    "conformacion_hombros": {
      "tipo": "actividad",
      "nombre": "Conformación de hombros tras subir la rasante",
      "nombre_en": "Shoulder build-up",
      "unidad": "m",
      "equipo": [
        "Motoniveladora",
        "Compactador",
        "Material granular"
      ]
    }
  },
  "costs": {
    "monitoreo": {
      "valor": 0,
      "unidad": "global"
    },
    "sellado_grietas": {
      "valor": 2.5,
      "unidad": "m"
    },
    "fog_seal": {
      "valor": 1.2,
      "unidad": "m2"
    },
    "rejuvenecedor": {
      "valor": 1.5,
      "unidad": "m2"
    },
    "sand_seal": {
      "valor": 2.0,
      "unidad": "m2"
    },
    "chip_seal": {
      "valor": 4.5,
      "unidad": "m2"
    },
    "slurry_seal": {
      "valor": 4.0,
      "unidad": "m2"
    },
    "micropavimento": {
      "valor": 6.0,
      "unidad": "m2"
    },
    "thin_overlay": {
      "valor": 12.0,
      "unidad": "m2"
    },
    "mill_and_replace": {
      "valor": 16.0,
      "unidad": "m2"
    },
    "sobrecapa_estructural": {
      "valor": 22.0,
      "unidad": "m2"
    },
    "fresado_sobrecapa_estructural": {
      "valor": 28.0,
      "unidad": "m2"
    },
    "fdr": {
      "valor": 30.0,
      "unidad": "m2"
    },
    "reconstruccion": {
      "valor": 65.0,
      "unidad": "m2"
    },
    "limpieza_superficie": {
      "valor": 0.3,
      "unidad": "m2"
    },
    "riego_liga": {
      "valor": 0.6,
      "unidad": "m2"
    },
    "parcheo_profundidad_parcial": {
      "valor": 35.0,
      "unidad": "m2"
    },
    "parcheo_profundidad_total": {
      "valor": 60.0,
      "unidad": "m2"
    },
    "parcheo_superficial": {
      "valor": 25.0,
      "unidad": "m2"
    },
    "fresado_local": {
      "valor": 20.0,
      "unidad": "m2"
    },
    "arenado_exudacion": {
      "valor": 1.0,
      "unidad": "m2"
    },
    "relleno_roderas": {
      "valor": 8.0,
      "unidad": "m2"
    },
    "nivelacion_hombros": {
      "valor": 8.0,
      "unidad": "m"
    },
    "conformacion_hombros": {
      "valor": 10.0,
      "unidad": "m"
    }
  },
  "levels": [
    {
      "id": "A1",
      "franja": "A",
      "pci_min": 85,
      "pci_max": 100,
      "nivel": "Mantenimiento preventivo",
      "categoria": "Muy bueno",
      "regla": "deterioro_dominante",
      "sin_fallas": [
        "monitoreo"
      ],
      "interinas": [
        "sellado_grietas",
        "monitoreo"
      ],
      "remision": [
        "MS-16 4.ª ed. 2009 (preservación)"
      ]
    },
    {
      "id": "A2",
      "franja": "A",
      "pci_min": 71,
      "pci_max": 84.99,
      "nivel": "Mantenimiento preventivo",
      "categoria": "Bueno",
      "regla": "deterioro_dominante",
      "sin_fallas": [
        "sellado_grietas",
        "monitoreo"
      ],
      "interinas": [
        "sellado_grietas",
        "monitoreo"
      ],
      "remision": [
        "MS-16 4.ª ed. 2009 (preservación)"
      ]
    },
    {
      "id": "B1",
      "franja": "B",
      "pci_min": 56,
      "pci_max": 70.99,
      "nivel": "Rehabilitación menor",
      "categoria": "Regular (alto)",
      "regla": "bordillo",
      "opciones_bordillo_suficiente": [
        "thin_overlay",
        "mill_and_replace"
      ],
      "opciones_bordillo_limitado": [
        "mill_and_replace"
      ],
      "opciones_rural": [
        "thin_overlay",
        "mill_and_replace"
      ],
      "interinas": [
        "micropavimento",
        "slurry_seal"
      ],
      "remision": [
        "MS-16 4.ª ed. 2009 (Fig. 1.4, Tabla 1.1)",
        "MS-17 (diseño de sobrecapas)"
      ]
    },
    {
      "id": "B2",
      "franja": "B",
      "pci_min": 41,
      "pci_max": 55.99,
      "nivel": "Rehabilitación mayor",
      "categoria": "Regular (bajo)",
      "regla": "bordillo",
      "opciones_bordillo_suficiente": [
        "sobrecapa_estructural",
        "fresado_sobrecapa_estructural",
        "fdr"
      ],
      "opciones_bordillo_limitado": [
        "fresado_sobrecapa_estructural",
        "fdr"
      ],
      "opciones_rural": [
        "sobrecapa_estructural",
        "fdr",
        "fresado_sobrecapa_estructural"
      ],
      "interinas": [
        "mill_and_replace",
        "thin_overlay"
      ],
      "remision": [
        "MS-17 (espesor de sobrecapa)",
        "MS-22 (construcción con mezcla en caliente)"
      ]
    },
    {
      "id": "C1",
      "franja": "C",
      "pci_min": 26,
      "pci_max": 40.99,
      "nivel": "Reconstrucción",
      "categoria": "Malo",
      "regla": "estructural",
      "opciones_estructura_recuperable": [
        "sobrecapa_estructural",
        "fresado_sobrecapa_estructural",
        "fdr",
        "reconstruccion"
      ],
      "opciones_estructura_perdida": [
        "reconstruccion",
        "fdr"
      ],
      "interinas": [
        "fresado_sobrecapa_estructural",
        "mill_and_replace"
      ],
      "remision": [
        "MS-4 (manual del asfalto)",
        "MS-22 (construcción con mezcla en caliente)"
      ]
    },
    {
      "id": "C2",
      "franja": "C",
      "pci_min": 0,
      "pci_max": 25.99,
      "nivel": "Reconstrucción",
      "categoria": "Muy malo / fallado",
      "regla": "fija",
      "opciones": [
        "reconstruccion",
        "fdr"
      ],
      "interinas": [
        "fresado_sobrecapa_estructural"
      ],
      "remision": [
        "MS-4 (manual del asfalto)",
        "MS-22 (construcción con mezcla en caliente)"
      ]
    }
  ],
  "defaults": {
    "_aviso": "Valores por defecto del agente. Los que dicen 'norma' vienen de la fuente indicada; los demás son supuestos de ingeniería sin norma y el inspector puede cambiarlos en el panel.",
    "bordillo_min_cm": {
      "valor": 7.6,
      "origen": "norma",
      "fuente": "MS-16 4.ª ed. 2009, Fig. 1.4 p. 13 y Tabla 1.1 p. 14 (3 in)"
    },
    "bordillo_desconocido": {
      "valor": "limitado",
      "origen": "supuesto",
      "nota": "Sin dato se asume bordillo < 7.6 cm (caso conservador)"
    },
    "clase_trafico_por_esal": {
      "origen": "norma",
      "fuente": "MS-2 (2014), niveles de tránsito de diseño Superpave: < 0.3, 0.3–3, ≥ 3 millones de ESAL",
      "bajo_max_millones": 0.3,
      "medio_max_millones": 3.0
    },
    "peso_severidad": {
      "L": 1,
      "M": 2,
      "H": 3,
      "U": 1,
      "origen": "supuesto"
    },
    "factor_grieta_bloque_m_por_m2": {
      "valor": 1.33,
      "origen": "supuesto",
      "nota": "Bloques de 1.5 m de lado: 2/1.5 m de grieta por m²"
    },
    "ancho_franja_grieta_m": {
      "valor": 0.3,
      "origen": "supuesto",
      "nota": "Franja a parchear en grietas H; ASTM menciona ~100 mm fracturados a cada lado"
    },
    "ancho_franja_borde_m": {
      "valor": 0.5,
      "origen": "supuesto",
      "nota": "ASTM: la grieta de borde está a 0.3–0.5 m del borde"
    },
    "ancho_deformacion_m": {
      "valor": 1.0,
      "origen": "supuesto",
      "nota": "Ancho afectado por abultamiento o hundimiento medido en metros lineales"
    },
    "area_por_bache_m2": {
      "L": 0.15,
      "M": 0.35,
      "H": 0.6,
      "origen": "supuesto",
      "nota": "Incluye el recorte rectangular alrededor del bache"
    },
    "sobreancho_parcheo": {
      "valor": 1.2,
      "origen": "supuesto",
      "nota": "Multiplica el área de parcheo para cortar en sano (0.3 m más por lado aprox.)"
    },
    "umbral_estructural_pct": {
      "valor": 20,
      "origen": "supuesto",
      "nota": "En C1, si el área con daño estructural M/H supera este % del tramo se asume estructura perdida"
    },
    "tasa_deterioro_alerta_pts_anio": {
      "valor": 4,
      "origen": "supuesto",
      "nota": "Alerta si (100 − PCI) / años desde la construcción o la última intervención supera este valor"
    },
    "peso_trafico": {
      "bajo": 1.0,
      "medio": 1.5,
      "alto": 2.0,
      "desconocido": 1.0,
      "origen": "supuesto"
    },
    "imprevistos_pct": {
      "valor": 10,
      "origen": "supuesto"
    },
    "densidad_minima_dominante_pct": {
      "valor": 0.5,
      "origen": "supuesto",
      "nota": "Por debajo, un grupo no se considera dominante"
    },
    "pci_minimo_aceptable": {
      "valor": 40,
      "origen": "supuesto",
      "fuente": "Límite regular/malo del MS-16 4.ª ed. 2009, Sec. 3.3.2 p. 34 (malo < 40)",
      "nota": "El beneficio solo cuenta la condición por encima de este PCI"
    },
    "curva_deterioro": {
      "beta": 1.5,
      "anios_hasta_pci_minimo": 20,
      "anios_hasta_pci_minimo_min": 5,
      "anios_hasta_pci_minimo_max": 40,
      "origen": "supuesto",
      "nota": "PCI(t) = 100 − α·t^β. β > 1: el deterioro se acelera con la edad. α sale de la edad y el PCI de cada tramo; sin edad, de los años por defecto hasta el PCI mínimo; se acota entre 5 y 40 años"
    }
  }
} as const;
