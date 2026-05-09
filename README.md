# Damm Smart Truck Copilot

Prototype for the Damm / DDI Interhack challenge.

The goal of this project is to optimize the full delivery operation, not only the route. The system proposes a delivery sequence, translates it into a truck loading plan, and assists the driver during the route.

> We do not optimize only for the shortest route. We optimize for a route that is easy to load, easy to unload, and realistic for the driver.

---

## Problem

DDI delivery trucks serve multiple hospitality clients in a single route. A truck can include around 15–25 deliveries, with many different product types: crates, kegs, bottles, packs, single units, cleaning products, food products and returnable containers.

Today, the warehouse preparation process is mainly product-oriented. This is efficient for picking and loading, but it can make unloading harder: the driver may need to search for products across different areas of the truck for each customer.

The challenge is to find a better balance between:

- Fast warehouse preparation.
- Efficient truck space usage.
- Easy unloading at each stop.
- Delivery order and customer time windows.
- Driver knowledge of the area.
- Returnable containers collected during the route.
- Real operational constraints such as lateral truck access, product handling and safety.

---

## Solution

**Damm Smart Truck Copilot** is a prototype that combines:

1. **Route optimization**  
   Generates a recommended delivery order using distance, customer zones, time windows, driver familiarity and operational constraints.

2. **Truck load optimization**  
   Converts the route into a physical loading plan, assigning products to truck slots or pallets according to delivery order, product type, accessibility and returnables.

3. **Driver copilot**  
   Provides explanations and assistance during the route, answering questions such as:
   - What do I need to unload at this stop?
   - Where is this customer’s merchandise?
   - Why is this stop recommended now?
   - What returnables should I collect?
   - What happens if I change the route order?

4. **Visual interface**  
   Shows the route, truck layout, loading plan, warnings, KPIs and operational recommendations.

---

## Core idea

The main concept is a **hybrid loading strategy**.

Instead of loading the truck only by product reference or only by customer, the system groups the route into delivery blocks.

Example:

```txt
Block A: stops 1–4
Block B: stops 5–8
Block C: stops 9–12
Block D: stops 13–18