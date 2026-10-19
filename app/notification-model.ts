export type ActivityNotification={
 id:number;actorId:string;actorName:string;kind:string;targetKind:'content'|'profile'|'conversation'|'request'|'commission';
 targetId:string;title:string;createdAt:string;readAt:string|null;
};
export type NotificationPage={items:ActivityNotification[];unread:number;latestId:number;hasMore:boolean;nextBefore:number|null};
export const notificationVerbs:Record<string,string>={
 like:'liked your post',comment:'commented on your post',follow:'started following you',
 connection:'opened a private conversation with you',message:'sent you a private message',
 proposal:'sent a proposal for your design request',proposal_accepted:'accepted your design proposal',
 materials_ready:'submitted fabric and materials for your review',design_ready:'submitted your finished garment for review',
 review_approved:'approved your production update',changes_requested:'requested changes to your production update',
};
