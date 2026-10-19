import {getAppUser} from '../../auth';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getAppUser();
 return Response.json({user:user?{id:user.userId,name:user.displayName,email:user.email}:null},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
}
