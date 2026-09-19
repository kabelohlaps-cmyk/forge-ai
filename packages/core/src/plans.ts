export enum PlanTier { FREE='free', CREATOR='creator', ARCHITECT='architect', STUDIO='studio' }
export interface PlanConfig { price_usd:string; renders:number; modes:string[]; features:string[] }
export const PLANS: Record<Exclude<PlanTier,PlanTier.FREE>, PlanConfig> = {
  [PlanTier.CREATOR]:{price_usd:'19.00',renders:200,modes:['vehicle','interior','product','architecture'],features:['200 renders / month','All creative modes','HD exports','Version history']},
  [PlanTier.ARCHITECT]:{price_usd:'39.00',renders:500,modes:['vehicle','interior','product','architecture','world','character','telecom'],features:['500 renders / month','+ World Building','+ Character Design','+ Telecommunications','PDF spec sheets']},
  [PlanTier.STUDIO]:{price_usd:'99.00',renders:-1,modes:['vehicle','interior','product','architecture','world','character','telecom','servers'],features:['Unlimited renders','+ Servers & Infrastructure','Team seats','API access','3D exports']},
};
export const FREE_TIER = { renders:10, modes:['vehicle','interior'] };
