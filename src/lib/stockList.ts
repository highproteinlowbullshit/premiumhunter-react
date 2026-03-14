export type Sector =
  | 'Technology'
  | 'Finance'
  | 'Crypto'
  | 'Energy'
  | 'Healthcare'
  | 'Consumer'
  | 'EV'
  | 'Automotive'
  | 'Industrial'
  | 'ETF';

export interface StockMeta {
  ticker: string;
  name: string;
  sector: Sector;
}

export const STOCK_LIST: StockMeta[] = [
  // High IV momentum stocks (sell premium targets)
  { ticker: 'GME',   name: 'GameStop',              sector: 'Consumer'    },
  { ticker: 'MARA',  name: 'Marathon Digital',       sector: 'Crypto'      },
  { ticker: 'SOFI',  name: 'SoFi Technologies',      sector: 'Finance'     },
  { ticker: 'RIVN',  name: 'Rivian Automotive',      sector: 'EV'          },
  { ticker: 'COIN',  name: 'Coinbase',               sector: 'Crypto'      },
  { ticker: 'HOOD',  name: 'Robinhood',              sector: 'Finance'     },
  { ticker: 'AMC',   name: 'AMC Entertainment',      sector: 'Consumer'    },
  { ticker: 'PLTR',  name: 'Palantir',               sector: 'Technology'  },
  { ticker: 'RBLX',  name: 'Roblox',                 sector: 'Technology'  },
  { ticker: 'SNAP',  name: 'Snap',                   sector: 'Technology'  },
  { ticker: 'UBER',  name: 'Uber',                   sector: 'Technology'  },
  { ticker: 'LYFT',  name: 'Lyft',                   sector: 'Technology'  },
  { ticker: 'IONQ',  name: 'IonQ',                   sector: 'Technology'  },
  { ticker: 'SMCI',  name: 'Super Micro Computer',   sector: 'Technology'  },
  { ticker: 'NVAX',  name: 'Novavax',                sector: 'Healthcare'  },
  { ticker: 'TLRY',  name: 'Tilray Brands',          sector: 'Consumer'    },
  { ticker: 'RIOT',  name: 'Riot Platforms',         sector: 'Crypto'      },
  { ticker: 'CLSK',  name: 'CleanSpark',             sector: 'Crypto'      },
  { ticker: 'MSTR',  name: 'MicroStrategy',          sector: 'Crypto'      },
  { ticker: 'WULF',  name: 'TeraWulf',               sector: 'Crypto'      },

  // Popular mid-cap tech (good premium, manageable risk)
  { ticker: 'TSLA',  name: 'Tesla',                  sector: 'EV'          },
  { ticker: 'NVDA',  name: 'NVIDIA',                 sector: 'Technology'  },
  { ticker: 'AMD',   name: 'Advanced Micro Devices', sector: 'Technology'  },
  { ticker: 'META',  name: 'Meta Platforms',         sector: 'Technology'  },
  { ticker: 'NFLX',  name: 'Netflix',                sector: 'Technology'  },
  { ticker: 'SHOP',  name: 'Shopify',                sector: 'Technology'  },
  { ticker: 'SQ',    name: 'Block',                  sector: 'Finance'     },
  { ticker: 'ROKU',  name: 'Roku',                   sector: 'Technology'  },
  { ticker: 'NET',   name: 'Cloudflare',             sector: 'Technology'  },
  { ticker: 'DDOG',  name: 'Datadog',                sector: 'Technology'  },
  { ticker: 'CRWD',  name: 'CrowdStrike',            sector: 'Technology'  },
  { ticker: 'SNOW',  name: 'Snowflake',              sector: 'Technology'  },
  { ticker: 'ZM',    name: 'Zoom',                   sector: 'Technology'  },
  { ticker: 'DOCN',  name: 'DigitalOcean',           sector: 'Technology'  },
  { ticker: 'MDB',   name: 'MongoDB',                sector: 'Technology'  },
  { ticker: 'BILL',  name: 'Bill Holdings',          sector: 'Finance'     },
  { ticker: 'AFRM',  name: 'Affirm',                 sector: 'Finance'     },
  { ticker: 'UPST',  name: 'Upstart',                sector: 'Finance'     },
  { ticker: 'OPEN',  name: 'Opendoor',               sector: 'Finance'     },
  { ticker: 'ABNB',  name: 'Airbnb',                 sector: 'Consumer'    },

  // Large cap with solid IV (safer wheel candidates)
  { ticker: 'AAPL',  name: 'Apple',                  sector: 'Technology'  },
  { ticker: 'MSFT',  name: 'Microsoft',              sector: 'Technology'  },
  { ticker: 'GOOGL', name: 'Alphabet',               sector: 'Technology'  },
  { ticker: 'AMZN',  name: 'Amazon',                 sector: 'Technology'  },
  { ticker: 'JPM',   name: 'JPMorgan Chase',         sector: 'Finance'     },
  { ticker: 'BAC',   name: 'Bank of America',        sector: 'Finance'     },
  { ticker: 'GS',    name: 'Goldman Sachs',          sector: 'Finance'     },
  { ticker: 'XOM',   name: 'ExxonMobil',             sector: 'Energy'      },
  { ticker: 'CVX',   name: 'Chevron',                sector: 'Energy'      },
  { ticker: 'DIS',   name: 'Disney',                 sector: 'Consumer'    },
  { ticker: 'NKE',   name: 'Nike',                   sector: 'Consumer'    },
  { ticker: 'BA',    name: 'Boeing',                 sector: 'Industrial'  },
  { ticker: 'F',     name: 'Ford',                   sector: 'Automotive'  },
  { ticker: 'GM',    name: 'General Motors',         sector: 'Automotive'  },
  { ticker: 'PFE',   name: 'Pfizer',                 sector: 'Healthcare'  },

  // ETFs (great for wheel, liquid, predictable)
  { ticker: 'SPY',   name: 'S&P 500 ETF',            sector: 'ETF'         },
  { ticker: 'QQQ',   name: 'Nasdaq 100 ETF',         sector: 'ETF'         },
  { ticker: 'IWM',   name: 'Russell 2000 ETF',       sector: 'ETF'         },
  { ticker: 'GLD',   name: 'Gold ETF',               sector: 'ETF'         },
  { ticker: 'SLV',   name: 'Silver ETF',             sector: 'ETF'         },
  { ticker: 'TLT',   name: '20yr Treasury ETF',      sector: 'ETF'         },
  { ticker: 'XLE',   name: 'Energy Select ETF',      sector: 'ETF'         },
  { ticker: 'XLF',   name: 'Financial Select ETF',   sector: 'ETF'         },
  { ticker: 'ARKK',  name: 'ARK Innovation ETF',     sector: 'ETF'         },
  { ticker: 'SOXL',  name: 'Semiconductor Bull ETF', sector: 'ETF'         },

  // Emerging and speculative (high IV, high premium)
  { ticker: 'LCID',  name: 'Lucid Group',            sector: 'EV'          },
  { ticker: 'NKLA',  name: 'Nikola',                 sector: 'EV'          },
  { ticker: 'CLOV',  name: 'Clover Health',          sector: 'Healthcare'  },
  { ticker: 'BBAI',  name: 'BigBear.ai',             sector: 'Technology'  },
  { ticker: 'SOUN',  name: 'SoundHound AI',          sector: 'Technology'  },
  { ticker: 'AISP',  name: 'Airship AI',             sector: 'Technology'  },
  { ticker: 'RGTI',  name: 'Rigetti Computing',      sector: 'Technology'  },
  { ticker: 'QBTS',  name: 'D-Wave Quantum',         sector: 'Technology'  },
  { ticker: 'KULR',  name: 'KULR Technology',        sector: 'Technology'  },
  { ticker: 'HIMS',  name: 'Hims & Hers Health',     sector: 'Healthcare'  },
];

/** O(1) lookup by ticker */
export const STOCK_META: Record<string, StockMeta> = Object.fromEntries(
  STOCK_LIST.map((s) => [s.ticker, s])
);
