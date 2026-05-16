export type Tier = 'free' | 'pro' | 'superuser'

export const TIER_ORDER: Record<Tier, number> = {
  free:      0,
  pro:       1,
  superuser: 2,
}

export const FEATURES = {
  // Free — always on
  paper_trading:               'free',
  help_page:                   'free',
  // Pro — paid
  screener:                    'pro',
  screener_top_picks:          'pro',
  screener_iv_trend:           'pro',
  screener_iv_hv:              'pro',
  screener_earnings_badge:     'pro',
  screener_account_filter:     'pro',
  watchlist:                   'pro',
  wheel_tracker:               'pro',
  wheel_live_prices:           'pro',
  wheel_assignment_gauge:      'pro',
  wheel_dte_traffic:           'pro',
  wheel_cycle_view:            'pro',
  wheel_monthly_target:        'pro',
  wheel_greeks_bar:            'pro',
  wheel_inline_edit:           'pro',
  wheel_urgency_banner:        'pro',
  dashboard:                   'pro',
  dashboard_greeks:            'pro',
  dashboard_positions_card:    'pro',
  dashboard_monthly_chart:     'pro',
  portfolio:                   'pro',
  portfolio_spy_benchmark:     'pro',
  portfolio_greeks:            'pro',
  portfolio_income_split:      'pro',
  portfolio_assigned_shares:   'pro',
  portfolio_leaps:             'pro',
  portfolio_ticker_performance:'pro',
  capital_redeployment:        'pro',
  scenario_analysis:           'pro',
  csv_export:                  'pro',
  leaps_valuator:              'pro',
  leaps_what_if:               'pro',
  ai_trade_analyst:            'pro',
  morning_briefing:            'pro',
  win_rate_by_setup:           'pro',
  expiry_outcome_calendar:     'pro',
  wheel_cycle_timeline:        'pro',
  assignment_flow:             'pro',
  cost_basis_tracker:          'pro',
  // Superuser — admin only
  admin_dashboard:             'superuser',
} as const

export type FeatureKey = keyof typeof FEATURES

export function hasAccess(userTier: Tier, feature: FeatureKey): boolean {
  if (userTier === 'superuser') return true
  const required = FEATURES[feature] as Tier
  if (required === 'superuser') return false
  return TIER_ORDER[userTier] >= TIER_ORDER[required]
}

export function getRequiredTier(feature: FeatureKey): Tier {
  return FEATURES[feature] as Tier
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  paper_trading:               'Paper trading ($100k virtual)',
  help_page:                   'Help and education centre',
  screener:                    'IV Rank Screener (200 stocks)',
  screener_top_picks:          'Top 5 CSP & CC picks daily',
  screener_iv_trend:           'IV rank trend arrows',
  screener_iv_hv:              'IV/HV ratio analysis',
  screener_earnings_badge:     'Earnings calendar badges',
  screener_account_filter:     'Account size filter',
  watchlist:                   'Watchlist with IV monitoring',
  wheel_tracker:               'Real money wheel tracker',
  wheel_live_prices:           'Live real-time prices',
  wheel_assignment_gauge:      'Assignment probability gauges',
  wheel_dte_traffic:           'DTE traffic light system',
  wheel_cycle_view:            'Cycle grouping view',
  wheel_monthly_target:        'Monthly income target tracker',
  wheel_greeks_bar:            'Greeks summary bar',
  wheel_inline_edit:           'Inline position editing',
  wheel_urgency_banner:        'Position urgency alerts',
  dashboard:                   'Full morning command centre',
  dashboard_greeks:            'Daily theta & Greeks panel',
  dashboard_positions_card:    'Positions intelligence card',
  dashboard_monthly_chart:     'Monthly income chart',
  portfolio:                   'Full portfolio tab',
  portfolio_spy_benchmark:     'Portfolio vs SPY benchmark',
  portfolio_greeks:            'Portfolio Greeks dashboard',
  portfolio_income_split:      'Income vs capital gains split',
  portfolio_assigned_shares:   'Assigned shares tracking',
  portfolio_leaps:             'LEAPS tracking',
  portfolio_ticker_performance:'Ticker performance table',
  capital_redeployment:        'Capital redeployment tracker',
  scenario_analysis:           'Portfolio scenario analysis',
  csv_export:                  'CSV export',
  leaps_valuator:              'LEAPS valuator with Greeks',
  leaps_what_if:               'What-if price simulator',
  ai_trade_analyst:            'AI trade analyst picks',
  morning_briefing:            'AI morning briefing email',
  win_rate_by_setup:           'Win rate by setup analysis',
  expiry_outcome_calendar:     'Expiry outcome calendar',
  wheel_cycle_timeline:        'Wheel cycle timeline',
  assignment_flow:             'Assignment flow wizard',
  cost_basis_tracker:          'Cost basis tracker',
  admin_dashboard:             'Admin dashboard',
}

export const FREE_FEATURES_LIST = [
  'Paper trading with $100,000 virtual money',
  'Full paper wheel tracker (CSP & CC)',
  'Paper portfolio with P&L chart',
  'Paper monthly income target',
  'Help centre and wheel strategy guide',
  'Practice the wheel risk-free, forever',
]

export const PRO_FEATURES_LIST = [
  'Everything in Free, plus:',
  'Full >400-stock IV rank screener',
  'Top 5 CSP & CC picks daily',
  'Real money wheel tracker (unlimited)',
  'Live real-time prices via WebSocket',
  'Assignment probability gauges',
  'DTE traffic light system',
  'Full portfolio tab with SPY benchmark',
  'Portfolio Greeks (daily theta income)',
  'LEAPS valuator with what-if simulator',
  'AI trade analyst daily picks',
  'Monthly income target tracker',
  'Assigned shares cost basis tracking',
  'Ticker performance league table',
  'IV trend arrows and IV/HV ratio',
  'Wheel cycle timeline',
]
