import {auth,authReady,isTeacher,loginTeacher,logoutTeacher,onAuthStateChanged} from './firebase.js';
export function mountAuthUI(onChange=()=>{}) {
  const panel = document.createElement('section');
  panel.className='max-w-4xl mx-auto px-4 pt-4 flex flex-wrap items-center justify-end gap-3 text-sm';
  const status=document.createElement('p'); status.setAttribute('role','status');
  const button=document.createElement('button'); button.type='button';
  button.className='bg-white border border-indigo-300 rounded-full px-4 py-2 text-indigo-700 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';
  button.textContent='老師 Google 登入';
  panel.append(status,button); document.body.prepend(panel);
  onAuthStateChanged(auth,user=>{
    status.textContent=isTeacher(user)?`老師：${user.email}`: user && !user.isAnonymous?'此帳號沒有老師權限':'學生可直接作答';
    button.textContent=user && !user.isAnonymous?'登出':'老師 Google 登入';
    onChange(isTeacher(user));
  });
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try {await authReady; if(auth.currentUser && !auth.currentUser.isAnonymous) await logoutTeacher(); else await loginTeacher();}
    catch(e){status.textContent=e.code==='auth/popup-closed-by-user'?'已取消登入':e.message;}
    finally {button.disabled=false;}
  });
}
