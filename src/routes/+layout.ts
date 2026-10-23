// 타이머 상태는 브라우저의 localStorage에만 있으므로 서버에서 그릴 내용이 없다.
// 서버 렌더링을 끄면 저장된 상태를 불러오기 전의 대기 화면이 잠깐 보이는 현상도 막을 수 있다.
export const ssr = false;

// 빌드할 때 빈 앱 셸을 index.html로 만들어 둔다.
// 이 파일이 없으면 GitHub Pages가 첫 화면을 404 상태 코드와 함께 404.html로 응답한다.
export const prerender = true;
