fabrics = {
  "cotton": 1.0,
  "linen": 1.1,
  "rayon": 1.1,
  "polyester": 0.9,

  "silk": 2.0,
  "banarasi silk": 2.5,
  "dupion silk": 2.2,
  "banglori silk": 2.1,
  "kora silk": 2.3,
  "taffeta silk": 2.4,
  "art silk": 1.7,
  "phantom silk": 1.8,

  "georgette": 1.4,
  "chiffon": 1.3,
  "organza": 1.8,
  "net": 1.5,
  "crepe": 1.4,
  "satin": 1.6,

  "velvet": 2.2,
  "brocade": 2.3,
  "jacquard": 2.0,
  "tissue": 2.1,
  "chanderi": 1.9,
  "khadi": 1.5,
  "phulkari": 2.0,
  "bandhej": 1.7,
  "brasso": 1.6,
  "viscose": 1.2,
  "lycra": 1.1
}
garments = {
  "saree": 120,
  "kurta_men": 80,
  "gowns": 180,
  "dupatta": 50,
  "dhoti_pants": 70,
  "blouse": 60,

    "lehenga": 250,

    "leggings_and_salwars": 60
}

fabric_variance = {

    "cotton": 0.10,
    "polyester": 0.10,
    "rayon": 0.12,

    "linen": 0.15,
    "georgette": 0.18,
    "chiffon": 0.18,

    "silk": 0.25,
    "banarasi silk": 0.35,
    "velvet": 0.35,
    "brocade": 0.30,
    "organza": 0.25
}

def get_price_range(garment, fabric):

    base_price = (
        garments.get(garment, 100)
        * fabrics.get(fabric, 1.0)
    )

    variance = fabric_variance.get(
        fabric,
        0.20
    )

    min_price = round(
        base_price * (1 - variance)
    )

    max_price = round(
        base_price * (1 + variance)
    )

    return {
        "min_price": min_price,
        "max_price": max_price
    }
