export const defaultPreferences={avatar:'',discoverable:true,showSales:true,notifyLikes:true,notifyComments:true,notifyFollows:true,notifyMessages:true,notifyOrders:true,theme:'system' as 'system'|'light'|'dark',textSize:'standard' as 'standard'|'large'|'extra-large',density:'comfortable' as 'comfortable'|'compact',motion:'system' as 'system'|'reduced'};
export type MemberPreferences=typeof defaultPreferences;
export type MemberComment={id:string;userId:string;name:string;avatar:string;body:string;createdAt:string};
