// Frontend helpers for quiz attempt + tab switch penalty
let quizActive = false;
window.startQuiz = function(quizId){
  quizActive = true;
  window.addEventListener('blur', ()=>{
    if(quizActive){
      fetch(`/quiz/${quizId}/forfeit`, {method:'POST'})
    }
  }, {once:true});
}
