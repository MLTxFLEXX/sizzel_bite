// SizzleBite Fast Food Dine-In Catalog & Configuration
const MENU_DATA = {
  restaurant: {
    name: "SizzleBite Gourmet Burgers & Chicken",
    tagline: "Fresh Off The Grill • Sizzling To Your Table",
    currency: "$",
    taxRate: 0.08, // 8% sales tax
    totalTables: 12,
    serviceCallTypes: [
      { id: "water", label: "Request Fresh Water", icon: "💧" },
      { id: "napkins", label: "Extra Napkins & Cutlery", icon: "🧻" },
      { id: "sauces", label: "Extra Dip / Sauces", icon: "🥫" },
      { id: "waiter", label: "Call Server to Table", icon: "🛎️" },
      { id: "bill", label: "Request Paper Bill", icon: "🧾" }
    ]
  },
  categories: [
    { id: "all", name: "All Items", icon: "🔥" },
    { id: "burgers", name: "Smash Burgers", icon: "🍔" },
    { id: "chicken", name: "Crispy Chicken", icon: "🍗" },
    { id: "sides", name: "Fries & Sides", icon: "🍟" },
    { id: "drinks", name: "Shakes & Drinks", icon: "🥤" },
    { id: "combos", name: "Value Combos", icon: "🍱" },
    { id: "desserts", name: "Desserts", icon: "🍦" }
  ],
  items: [
    {
      id: "b1",
      name: "The Double Sizzle Smash",
      category: "burgers",
      price: 11.99,
      calories: 820,
      prepTime: "6-8 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
      description: "Two 100% Angus smash beef patties, double melted cheddar, caramelized onions, house pickles, and secret Sizzle burger sauce on a toasted brioche bun.",
      customizations: {
        patty: {
          title: "Choose Patty Style",
          type: "radio",
          required: true,
          options: [
            { name: "Double Angus Beef (Included)", price: 0 },
            { name: "Triple Angus Beef", price: 3.50 },
            { name: "Beyond Meat Plant-Based", price: 1.50 }
          ]
        },
        addons: {
          title: "Add Extra Toppings",
          type: "checkbox",
          options: [
            { name: "Crispy Smoked Bacon", price: 1.95 },
            { name: "Extra Melted Cheddar", price: 1.25 },
            { name: "Grilled Jalapeños", price: 0.95 },
            { name: "Fried Farm Egg", price: 1.50 },
            { name: "Truffle Aioli Dip", price: 1.20 }
          ]
        }
      }
    },
    {
      id: "b2",
      name: "Fiery Nashville Crispy Bird",
      category: "chicken",
      price: 10.49,
      calories: 740,
      prepTime: "7-9 mins",
      isPopular: true,
      isChefSpecial: false,
      isSpicy: true,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80",
      description: "Buttermilk fried chicken breast dipped in Nashville hot spice glaze, spicy tangy slaw, dill pickles, and creamy ranch on potato roll.",
      customizations: {
        spiceLevel: {
          title: "Heat Level",
          type: "radio",
          required: true,
          options: [
            { name: "Medium Hot (Classic)", price: 0 },
            { name: "Blazing Hot 🔥🔥", price: 0 },
            { name: "Mild / No Heat", price: 0 }
          ]
        },
        addons: {
          title: "Tasty Add-ons",
          type: "checkbox",
          options: [
            { name: "Extra Slaw", price: 0.95 },
            { name: "Pepper Jack Cheese", price: 1.25 },
            { name: "Hot Honey Drizzle", price: 1.20 }
          ]
        }
      }
    },
    {
      id: "b3",
      name: "Truffle & Mushroom Melt",
      category: "burgers",
      price: 12.99,
      calories: 790,
      prepTime: "8-10 mins",
      isPopular: false,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80",
      description: "Char-grilled beef patty, garlic-sautéed wild forest mushrooms, melted Swiss gruyère, and black truffle crema on toasted artisan roll.",
      customizations: {
        patty: {
          title: "Select Patty",
          type: "radio",
          required: true,
          options: [
            { name: "Classic Prime Beef", price: 0 },
            { name: "Double Patty", price: 3.50 },
            { name: "Portobello Mushroom Patty (Veg)", price: 0 }
          ]
        },
        addons: {
          title: "Extras",
          type: "checkbox",
          options: [
            { name: "Extra Swiss Cheese", price: 1.50 },
            { name: "Caramelized Balsamic Onions", price: 1.20 },
            { name: "Crispy Bacon", price: 1.95 }
          ]
        }
      }
    },
    {
      id: "b4",
      name: "Smoky BBQ Bacon Cheeseburger",
      category: "burgers",
      price: 11.49,
      calories: 890,
      prepTime: "6-8 mins",
      isPopular: true,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80",
      description: "Thick beef patty, hickory smoked bacon slices, crispy beer-battered onion rings, aged cheddar, and tangy BBQ glaze.",
      customizations: {
        patty: {
          title: "Patty Size",
          type: "radio",
          required: true,
          options: [
            { name: "Quarter Pound Beef", price: 0 },
            { name: "Half Pound Double Beef", price: 3.20 }
          ]
        },
        addons: {
          title: "Extra Boost",
          type: "checkbox",
          options: [
            { name: "Double Bacon", price: 1.95 },
            { name: "Jalapeño Popper on Top", price: 1.80 },
            { name: "Chipotle Mayo", price: 0.95 }
          ]
        }
      }
    },
    {
      id: "b5",
      name: "Garden Harvest Green Burger",
      category: "burgers",
      price: 10.25,
      calories: 560,
      prepTime: "6-7 mins",
      isPopular: false,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=800&q=80",
      description: "Crispy spiced black bean & quinoa patty, smashed avocado, vine tomatoes, arugula, and cilantro herb aioli on a toasted multigrain bun.",
      customizations: {
        bun: {
          title: "Bun Selection",
          type: "radio",
          required: true,
          options: [
            { name: "Toasted Multigrain Bun", price: 0 },
            { name: "Gluten-Free Artisan Bun", price: 1.50 },
            { name: "Crisp Lettuce Wrap", price: 0 }
          ]
        },
        addons: {
          title: "Add-ons",
          type: "checkbox",
          options: [
            { name: "Vegan Cheddar Slice", price: 1.25 },
            { name: "Extra Smashed Avocado", price: 1.80 },
            { name: "Pickled Red Onions", price: 0.75 }
          ]
        }
      }
    },
    {
      id: "c1",
      name: "Crispy Golden Chicken Tenders (5pcs)",
      category: "chicken",
      price: 8.99,
      calories: 620,
      prepTime: "5-7 mins",
      isPopular: true,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
      description: "Hand-breaded fresh chicken tenderloins fried to ultra-crispy perfection. Served with your choice of signature dipping sauce.",
      customizations: {
        sauce: {
          title: "Choose 1st Dip Sauce",
          type: "radio",
          required: true,
          options: [
            { name: "Signature Sizzle Sauce", price: 0 },
            { name: "Garlic Parmesan Mayo", price: 0 },
            { name: "Honey Mustard", price: 0 },
            { name: "Spicy Ghost Pepper BBQ", price: 0 }
          ]
        },
        extraSauce: {
          title: "Extra Dips",
          type: "checkbox",
          options: [
            { name: "Extra Sizzle Sauce Cup", price: 0.90 },
            { name: "Buttermilk Ranch Cup", price: 0.90 }
          ]
        }
      }
    },
    {
      id: "c2",
      name: "Korean Sweet & Spicy Wings",
      category: "chicken",
      price: 11.25,
      calories: 780,
      prepTime: "8-10 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: true,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1527477378377-f8e5b61b7fcf?auto=format&fit=crop&w=800&q=80",
      description: "Double-fried Jumbo wings coated in sticky Gochujang chili glaze, toasted sesame seeds, and scallions.",
      customizations: {
        wingCount: {
          title: "Portion Size",
          type: "radio",
          required: true,
          options: [
            { name: "6 Wings", price: 0 },
            { name: "10 Wings (Hungry Size)", price: 4.50 }
          ]
        }
      }
    },
    {
      id: "s1",
      name: "Sizzle Loaded Monster Fries",
      category: "sides",
      price: 6.99,
      calories: 680,
      prepTime: "4-6 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: true,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=800&q=80",
      description: "Crispy skin-on golden fries drenched in warm molten cheddar cheese, crispy bacon bits, chopped jalapeños, and Sizzle drizzle.",
      customizations: {
        extras: {
          title: "Custom Upgrades",
          type: "checkbox",
          options: [
            { name: "Add Chopped Beef Patty", price: 2.20 },
            { name: "Extra Melted Cheese Sauce", price: 1.50 },
            { name: "Sour Cream & Chives", price: 1.00 }
          ]
        }
      }
    },
    {
      id: "s2",
      name: "Beer-Battered Crispy Onion Rings",
      category: "sides",
      price: 5.49,
      calories: 420,
      prepTime: "4-5 mins",
      isPopular: false,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1639024471285-0afc3835697c?auto=format&fit=crop&w=800&q=80",
      description: "Thick sweet Spanish onion rings dipped in craft IPA batter and fried crisp. Served with smoky chipotle aioli dip.",
      customizations: {}
    },
    {
      id: "s3",
      name: "Truffle Parmesan Herb Fries",
      category: "sides",
      price: 6.49,
      calories: 490,
      prepTime: "4-5 mins",
      isPopular: false,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80",
      description: "Shoestring fries tossed with white truffle oil, grated aged parmesan reggiano, and chopped Italian parsley.",
      customizations: {}
    },
    {
      id: "s4",
      name: "Crispy Mozzarella Sticks (6pcs)",
      category: "sides",
      price: 6.25,
      calories: 520,
      prepTime: "4-5 mins",
      isPopular: true,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1531749668029-2db88e4276c7?auto=format&fit=crop&w=800&q=80",
      description: "Golden herb-seasoned breaded mozzarella cheese sticks with an epic cheese pull. Served with warm zesty marinara sauce.",
      customizations: {}
    },
    {
      id: "d1",
      name: "Salted Caramel Pretzel Shake",
      category: "drinks",
      price: 6.25,
      calories: 590,
      prepTime: "3-4 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80",
      description: "Hand-spun rich vanilla ice cream, ribbons of sea-salted butter caramel, crushed butter pretzels, and whipped cream crown.",
      customizations: {
        milk: {
          title: "Milk Base",
          type: "radio",
          required: true,
          options: [
            { name: "Whole Dairy Milk", price: 0 },
            { name: "Oat Milk Alternative", price: 1.00 }
          ]
        }
      }
    },
    {
      id: "d2",
      name: "Double Dark Chocolate Fudge Shake",
      category: "drinks",
      price: 5.99,
      calories: 610,
      prepTime: "3-4 mins",
      isPopular: false,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=800&q=80",
      description: "Decadent Dutch cocoa ice cream, molten chocolate fudge swirl, chocolate chips, and fresh whipped cream.",
      customizations: {}
    },
    {
      id: "d3",
      name: "Artisan Craft Soda Fountain",
      category: "drinks",
      price: 3.25,
      calories: 140,
      prepTime: "1 min",
      isPopular: false,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80",
      description: "Chilled cane-sugar craft fountain soda with unlimited refills at the beverage station while dining in.",
      customizations: {
        flavor: {
          title: "Choose Beverage",
          type: "radio",
          required: true,
          options: [
            { name: "Classic Cola", price: 0 },
            { name: "Zero Sugar Cola", price: 0 },
            { name: "Sparkling Lemon-Lime", price: 0 },
            { name: "Vintage Spiced Root Beer", price: 0 },
            { name: "Fresh Iced Lemon Tea", price: 0 }
          ]
        }
      }
    },
    {
      id: "cb1",
      name: "The Sizzle Boss Feast Combo",
      category: "combos",
      price: 16.99,
      calories: 1350,
      prepTime: "8-10 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80",
      description: "The complete table feast! Double Sizzle Smash Burger, Loaded Monster Fries, and your choice of Craft Shake or Fountain Soda.",
      customizations: {
        drinkChoice: {
          title: "Included Combo Drink",
          type: "radio",
          required: true,
          options: [
            { name: "Fountain Soda (Refillable)", price: 0 },
            { name: "Upgrade to Salted Caramel Shake", price: 3.00 },
            { name: "Upgrade to Chocolate Fudge Shake", price: 3.00 }
          ]
        },
        burgerChoice: {
          title: "Burger Cheese Upgrades",
          type: "checkbox",
          options: [
            { name: "Add Extra Smoked Bacon", price: 1.95 },
            { name: "Make Burger Triple Patty", price: 3.50 }
          ]
        }
      }
    },
    {
      id: "cb2",
      name: "Crispy Duo Chicken Feast",
      category: "combos",
      price: 15.49,
      calories: 1220,
      prepTime: "8-10 mins",
      isPopular: true,
      isChefSpecial: false,
      isSpicy: true,
      isVeg: false,
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
      description: "Nashville Hot Chicken Sandwich + 3 Crispy Golden Tenders + Seasoned Fries + Fountain Drink.",
      customizations: {
        dip: {
          title: "Dip for Tenders",
          type: "radio",
          required: true,
          options: [
            { name: "House Sizzle Sauce", price: 0 },
            { name: "Creamy Garlic Mayo", price: 0 },
            { name: "Hot Honey Drizzle", price: 0.50 }
          ]
        }
      }
    },
    {
      id: "ds1",
      name: "Warm Nutella Churro Bites",
      category: "desserts",
      price: 5.99,
      calories: 450,
      prepTime: "4-5 mins",
      isPopular: true,
      isChefSpecial: true,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=800&q=80",
      description: "Crispy cinnamon-sugar dusted mini churro bites with a warm cup of molten Nutella dipping hazelnut fudge.",
      customizations: {}
    },
    {
      id: "ds2",
      name: "Sizzling Hot Brownie & Vanilla Bean Ice Cream",
      category: "desserts",
      price: 6.49,
      calories: 580,
      prepTime: "4-5 mins",
      isPopular: false,
      isChefSpecial: false,
      isSpicy: false,
      isVeg: true,
      image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
      description: "Freshly baked double chocolate fudge brownie served warm with a scoop of Madagascar vanilla bean gelato and chocolate curls.",
      customizations: {}
    }
  ]
};

// Initial state and sample active orders to demonstrate KDS & live table updates
const INITIAL_DEMO_DATA = {
  activeOrders: [
    {
      id: "ORD-9421",
      tableNumber: 3,
      createdAt: Date.now() - 480000, // 8 minutes ago
      status: "cooking", // 'received', 'cooking', 'ready', 'served'
      paymentMethod: "pay_at_table",
      items: [
        {
          id: "b1",
          name: "The Double Sizzle Smash",
          price: 13.94,
          quantity: 2,
          customizationsText: "Double Angus Beef, Crispy Smoked Bacon",
          instructions: "Well done patties please"
        },
        {
          id: "s1",
          name: "Sizzle Loaded Monster Fries",
          price: 6.99,
          quantity: 1,
          customizationsText: "Standard Loaded",
          instructions: "Jalapeños on the side"
        },
        {
          id: "d1",
          name: "Salted Caramel Pretzel Shake",
          price: 6.25,
          quantity: 2,
          customizationsText: "Whole Dairy Milk",
          instructions: ""
        }
      ],
      subtotal: 41.12,
      tax: 3.29,
      tip: 4.00,
      total: 48.41,
      estimatedTime: 5
    },
    {
      id: "ORD-9422",
      tableNumber: 7,
      createdAt: Date.now() - 180000, // 3 minutes ago
      status: "received",
      paymentMethod: "instant_card",
      items: [
        {
          id: "cb1",
          name: "The Sizzle Boss Feast Combo",
          price: 19.99,
          quantity: 1,
          customizationsText: "Upgrade to Salted Caramel Shake",
          instructions: "Extra crispy fries"
        }
      ],
      subtotal: 19.99,
      tax: 1.60,
      tip: 2.00,
      total: 23.59,
      estimatedTime: 8
    }
  ],
  serviceRequests: [
    {
      id: "SRV-101",
      tableNumber: 3,
      type: "water",
      text: "Request Fresh Water",
      time: Date.now() - 120000,
      handled: false
    }
  ]
};

// Export for browser
if (typeof window !== "undefined") {
  window.MENU_DATA = MENU_DATA;
  window.INITIAL_DEMO_DATA = INITIAL_DEMO_DATA;
}
