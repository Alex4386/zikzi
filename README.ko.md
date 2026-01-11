<h1 align="center">Zikzi</h1>
<p align="center">웹 프린터</p>


## 뭐에 쓰는 건가요?
**TL:DR** - 그냥 **모O의프린터를 웹페이지로 만들어 놓고 여러명이 쓸 수 있게 만들어 놓은 프로그램** 입니다.

그냥 소프트웨어 기반 네트워크 프린터입니다. 문서를 인쇄하고, 웹 인터페이스에서 PDF 파일로 내보낼 수 있습니다.  

모O의프린터와 비슷하게 이런 경우에서 쓰면 됩니다:
- 대법원 인터넷등기소처럼 프린터 거르는 요상한 사이트
  - 이런 사이트들은 좀 프린터를 설치할때 꼼수를 써야 해요. [PRINT.ko.md](.github/docs/PRINT.ko.md) 문서를 참고 해 주세요.
- 물리적 프린터는 없는데 PDF 로 뽑아서 보긴 해야 할 때

## 기능
- `:9100` raw 프린팅 프로토콜을 이용한 네트워크 프린터 에뮬레이션
- IPP 프린팅 지원
- 인쇄 작업 관리 및 PDF 다운로드가 가능한 웹 인터페이스
- OIDC 인증을 통한 다중 사용자 지원
- GhostScript를 이용한 인쇄 작업 PDF 변환

## 설치
자세한 설치 방법은 [INSTALL.md](INSTALL.md)를 참고하세요.

## 라이선스
[MIT License](LICENSE)

## 사용된 오픈소스
- [GhostScript](https://www.ghostscript.com/) - PDF 렌더링 및 처리
