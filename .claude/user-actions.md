# 사용자(PM) 액션 체크리스트

[← CLAUDE.md](../CLAUDE.md)

Claude가 못 하는 것 — **사용자가 직접** 해야 하는 액션들. Phase 별로.

## 🔴 지금 당장 (CI 정상화 — Phase 1.5 wrap-up)

### 1. CodeRabbit GitHub App 설치 (1분, 무료)

**왜**: 현재 머지 게이트 `coderabbitai approved`가 작동하려면 CodeRabbit이 레포에 권한 있어야 함. 미설치 → 모든 PR CI FAIL.

**방법**:

1. <https://github.com/marketplace/coderabbitai> 접속
2. "Set up a plan" → Free tier 선택
3. "Install it for free" → `kimjhyun0627` account 선택
4. "Only select repositories" → `kimjhyun0627/getit-9th-mentoring` 체크 → Install

설치 직후 진행 중 PR들에 자동으로 CodeRabbit 리뷰 시작.

### 2. (선택) Gemini Code Assist 비활성화

**왜**: Gemini가 베타라 APPROVED 못 줘서 보조 의견용으로만 쓰임. 노이즈 많으면 제거 가능.

**방법**:
GitHub Settings → Installed GitHub Apps → Gemini Code Assist → Configure → 본 레포 제거.

---

## 🟡 Phase 2 완료 후 (Auth BE/FE 머지 직후 ~ Phase 4 시작 전)

### 3. GCP 계정 + 결제 설정 (10분)

**왜**: Compute Engine VM (`e2-medium`, ~$25/월) 띄워야 모든 앱 배포 가능.

**방법**:

1. <https://console.cloud.google.com> 로그인
2. 새 프로젝트 생성 (예: `getit-9th-prod`)
3. **Billing** 결제 카드 등록 (해외결제 가능 비자/마스터)
4. **APIs** 활성화: Compute Engine, Artifact Registry, Cloud Storage, Secret Manager
5. (선택) **Free Trial $300 크레딧** 받기 (신규 계정만)
6. gcloud CLI 로컬 설치 + 인증:

   ```bash
   brew install --cask google-cloud-sdk   # 또는 curl 설치
   gcloud auth login
   gcloud config set project getit-9th-prod
   ```

### 4. 가비아 DNS 설정 (5분)

**왜**: `get-it.cloud`의 A 레코드를 GCP VM 정적 IP로 연결해야 `*.get-it.cloud` 접근 가능.

**방법** (Claude가 VM IP 알려주면 그걸로):

1. 가비아 My가비아 → 도메인 관리 → `get-it.cloud` → DNS 설정
2. 레코드 추가:
   - 타입 `A`, 호스트 `@`, 값 `<VM 정적 IP>`, TTL 300
   - 타입 `A`, 호스트 `*`, 값 `<VM 정적 IP>`, TTL 300 (와일드카드 — `*.get-it.cloud`)
3. 저장 후 5-10분 대기 (`dig get-it.cloud` 로 확인)

### 5. GitHub Secrets 등록 (5분)

**왜**: 배포 워크플로우가 시크릿을 GitHub Actions에서 주입.

**방법**: <https://github.com/kimjhyun0627/getit-9th-mentoring/settings/secrets/actions>

| Secret | 값 출처 |
| :--- | :--- |
| `GCP_PROJECT_ID` | GCP 콘솔 프로젝트 ID |
| `GCP_SA_KEY` | GCP Service Account JSON (Compute Admin + Artifact Registry Writer) |
| `JWT_SECRET` | `openssl rand -base64 48` 결과 |
| `MYSQL_ROOT_PASSWORD` | 강한 랜덤 비밀번호 |
| `DATABASE_URL` | `mysql://app:<pw>@mysql:3306/auth_prod` |
| `SENTRY_DSN` | (선택) Sentry 프로젝트 DSN |
| `VM_SSH_PRIVATE_KEY` | gcloud SSH 키 또는 별도 SSH 키 페어 private |

GCP Service Account JSON 만드는 법:

```bash
gcloud iam service-accounts create getit-deployer
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:getit-deployer@$PROJECT.iam.gserviceaccount.com --role=roles/compute.admin
gcloud iam service-accounts keys create key.json --iam-account=getit-deployer@$PROJECT.iam.gserviceaccount.com
# key.json 내용 통째로 GCP_SA_KEY 시크릿에 붙여넣기. 로컬 파일은 즉시 삭제.
```

---

## 🟢 Phase 4 (실 배포 — Claude가 인프라 코드 다 깐 뒤)

### 6. GCP VM 프로비저닝 승인 (Claude 자동 + 확인)

Claude가 Terraform 또는 `gcloud compute instances create` 스크립트 준비. 사용자는:

- 청구서 발생 확인 + 한도 설정 (선택 — GCP Console → Billing → Budgets)
- VM 생성 후 IP 확인 → 4번(가비아 DNS) 갱신
- 첫 deploy 후 HTTPS 인증서 발급 확인 (Traefik 자동 처리)

### 7. (선택) 도메인 이메일 / SPF / DKIM

향후 이메일 발송 기능(비밀번호 재설정 등) 추가 시. 현재 Phase 4에선 불필요.

---

## ❓ 이슈 발생 시 확인

| 증상 | 원인 후보 | 액션 |
| :--- | :--- | :--- |
| PR CI `coderabbitai approved` FAIL | CodeRabbit 미설치 또는 미리뷰 | 1번 액션 |
| `*.get-it.cloud` 응답 X | DNS 미설정 / 전파 중 | 4번 액션 |
| Deploy step "permission denied" | GitHub Secrets 누락 또는 권한 부족 | 5번 액션 + IAM role 확인 |
| HTTPS 자동 발급 실패 | Let's Encrypt rate limit / 80 포트 막힘 | Traefik 로그 확인 |

## Claude vs 사용자 책임 매트릭스

| 영역 | Claude | 사용자 |
| :--- | :---: | :---: |
| 코드 작성 (FE/BE/DB) | ✅ | — |
| 테스트 + lint + format | ✅ | — |
| PR 생성/머지 (admin bypass) | ✅ | — |
| 디자인 + 시안 | ✅ | (선택) |
| Docker / docker-compose | ✅ | — |
| Traefik 설정 | ✅ | — |
| GitHub Actions 워크플로우 | ✅ | — |
| **GCP 계정 + 결제** | — | ✅ |
| **GCP IAM Service Account** | — | ✅ |
| **DNS 레코드 (가비아)** | — | ✅ |
| **GitHub App 설치 (CodeRabbit)** | — | ✅ |
| **GitHub Secrets 등록** | — | ✅ |
| Sentry/모니터링 SaaS 계정 | — | ✅ (선택) |
