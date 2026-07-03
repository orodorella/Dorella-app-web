export interface PricingItemMock {
  id: string;
  category: string;
  name: string;
  unitCost: number;
}

export const pricingItems: PricingItemMock[] = [
  { id: 'lisa-3', category: 'Balineria Lisa', name: '#3', unitCost: 1400 },
  { id: 'lisa-4', category: 'Balineria Lisa', name: '#4', unitCost: 2500 },
  { id: 'lisa-5', category: 'Balineria Lisa', name: '#5', unitCost: 4900 },
  { id: 'lisa-6', category: 'Balineria Lisa', name: '#6', unitCost: 7400 },
  { id: 'lisa-8', category: 'Balineria Lisa', name: '#8', unitCost: 12300 },
  { id: 'diamantada-3', category: 'Balineria Diamantada', name: '#3', unitCost: 1600 },
  { id: 'diamantada-4', category: 'Balineria Diamantada', name: '#4', unitCost: 2800 },
  { id: 'diamantada-5', category: 'Balineria Diamantada', name: '#5', unitCost: 4400 },
  { id: 'diamantada-6', category: 'Balineria Diamantada', name: '#6', unitCost: 6250 },
  { id: 'diamantada-8', category: 'Balineria Diamantada', name: '#8', unitCost: 10500 },
  { id: 'frances-4', category: 'Balineria Frances', name: '#4', unitCost: 4300 },
  { id: 'frances-5', category: 'Balineria Frances', name: '#5', unitCost: 5000 },
  { id: 'frances-6', category: 'Balineria Frances', name: '#6', unitCost: 5400 },
  { id: 'frances-8', category: 'Balineria Frances', name: '#8', unitCost: 8600 },
  { id: 'argollado-6', category: 'Neoprenos y Otros', name: 'Argollado 6', unitCost: 4200 },
  { id: 'argollado-8', category: 'Neoprenos y Otros', name: 'Argollado 8', unitCost: 4500 },
  { id: 'rondeles-4', category: 'Neoprenos y Otros', name: 'Rondeles 4mm', unitCost: 7500 },
  { id: 'rondeles-5', category: 'Neoprenos y Otros', name: 'Rondeles 5mm', unitCost: 10500 },
];
