/* ==========================================================================
   Open Food Facts & Product Intelligence Lookup Engine
   ========================================================================== */

class ProductLookupService {
    constructor() {
        this.cache = new Map();
        
        // Comprehensive fallback database for instant offline/sample test lookups
        this.sampleMockDb = {
            "5449000000996": {
                barcode: "5449000000996",
                title: "Coca-Cola Original Taste 330ml Can",
                brand: "Coca-Cola",
                category: "Beverages / Carbonated Soft Drinks",
                quantity: "330 ml",
                nutriScore: "e",
                ecoScore: "b",
                image: "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.716.400.jpg",
                format: "EAN-13"
            },
            "3017620422003": {
                barcode: "3017620422003",
                title: "Nutella Hazelnut & Cocoa Spread",
                brand: "Ferrero Nutella",
                category: "Spreads / Chocolate & Hazelnut Spreads",
                quantity: "400 g",
                nutriScore: "e",
                ecoScore: "d",
                image: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.427.400.jpg",
                format: "EAN-13"
            },
            "7622210449283": {
                barcode: "7622210449283",
                title: "Oreo Original Chocolate Sandwich Cookies",
                brand: "Oreo / Mondelez",
                category: "Biscuits & Cakes / Cookies",
                quantity: "154 g",
                nutriScore: "e",
                ecoScore: "c",
                image: "https://images.openfoodfacts.org/images/products/762/221/044/9283/front_fr.112.400.jpg",
                format: "EAN-13"
            },
            "8715700421377": {
                barcode: "8715700421377",
                title: "Heinz Tomato Ketchup Squeeze Bottle",
                brand: "Heinz",
                category: "Condiments / Sauces / Tomato Ketchup",
                quantity: "400 ml",
                nutriScore: "c",
                ecoScore: "b",
                image: "https://images.openfoodfacts.org/images/products/871/570/042/1377/front_fr.109.400.jpg",
                format: "EAN-13"
            },
            "5000159461122": {
                barcode: "5000159461122",
                title: "Snickers Peanut Chocolate Bar",
                brand: "Mars Snickers",
                category: "Confectionery / Chocolate Bars",
                quantity: "50 g",
                nutriScore: "e",
                ecoScore: "d",
                image: "https://images.openfoodfacts.org/images/products/500/015/946/1122/front_en.115.400.jpg",
                format: "EAN-13"
            },
            "012000000133": {
                barcode: "012000000133",
                title: "Pepsi Cola Original Can",
                brand: "PepsiCo",
                category: "Beverages / Sodas",
                quantity: "355 ml",
                nutriScore: "e",
                ecoScore: "c",
                image: "https://images.openfoodfacts.org/images/products/001/200/000/0133/front_en.15.400.jpg",
                format: "UPC-A"
            }
        };
    }

    async fetchProductData(barcode) {
        const cleanCode = String(barcode).trim();
        
        // 1. Check local cache
        if (this.cache.has(cleanCode)) {
            return this.cache.get(cleanCode);
        }

        // 2. Check built-in mock samples
        if (this.sampleMockDb[cleanCode]) {
            const data = this.sampleMockDb[cleanCode];
            this.cache.set(cleanCode, data);
            return data;
        }

        // 3. Query Open Food Facts API (REST V2)
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const json = await response.json();
                if (json.status === 1 && json.product) {
                    const prod = json.product;
                    const result = {
                        barcode: cleanCode,
                        title: prod.product_name || prod.product_name_en || "Product " + cleanCode,
                        brand: prod.brands || "Unknown Brand",
                        category: prod.categories ? prod.categories.split(',')[0] : "General Item",
                        quantity: prod.quantity || "N/A",
                        nutriScore: prod.nutriscore_grade ? prod.nutriscore_grade.toLowerCase() : "--",
                        ecoScore: prod.ecoscore_grade ? prod.ecoscore_grade.toLowerCase() : "--",
                        image: prod.image_front_url || prod.image_url || null,
                        format: cleanCode.length === 13 ? "EAN-13" : cleanCode.length === 12 ? "UPC-A" : "CODE-128"
                    };

                    this.cache.set(cleanCode, result);
                    return result;
                }
            }
        } catch (err) {
            console.warn("OpenFoodFacts API query failed or offline, falling back to basic metadata:", err);
        }

        // 4. Fallback for unlisted/offline barcodes
        const fallbackResult = {
            barcode: cleanCode,
            title: `Barcode ${cleanCode}`,
            brand: "Generic Product",
            category: "Uncategorized Item",
            quantity: "N/A",
            nutriScore: "--",
            ecoScore: "--",
            image: null,
            format: cleanCode.length === 13 ? "EAN-13" : cleanCode.length === 8 ? "EAN-8" : "UPC / CODE-128"
        };
        this.cache.set(cleanCode, fallbackResult);
        return fallbackResult;
    }
}

window.productLookupService = new ProductLookupService();
