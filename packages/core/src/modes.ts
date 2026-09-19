export type ModeId = 'vehicle'|'interior'|'product'|'architecture'|'world'|'character'|'telecom'|'servers';
export interface ModeMeta { id:ModeId; label:string; icon:string; family:'creative'|'narrative'|'systems'; persona:string; tier:'free'|'creator'|'architect'|'studio' }
export const MODES: ModeMeta[] = [
  {id:'vehicle',label:'Vehicle',icon:'🚗',family:'creative',persona:'Chassis',tier:'free'},
  {id:'interior',label:'Interior',icon:'🏠',family:'creative',persona:'Hearth',tier:'free'},
  {id:'product',label:'Product',icon:'📦',family:'creative',persona:'Maker',tier:'creator'},
  {id:'architecture',label:'Architecture',icon:'🏛',family:'creative',persona:'Cornerstone',tier:'creator'},
  {id:'world',label:'World Building',icon:'🌍',family:'narrative',persona:'Lorekeeper',tier:'architect'},
  {id:'character',label:'Character',icon:'🧑',family:'narrative',persona:'Chromas',tier:'architect'},
  {id:'telecom',label:'Telecom',icon:'📡',family:'systems',persona:'Relay',tier:'architect'},
  {id:'servers',label:'Servers',icon:'🖥',family:'systems',persona:'Bastion',tier:'studio'},
];
