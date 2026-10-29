// 앱의 데이터를 담는 IndexedDB 데이터베이스.
//
// 저장소
// - state: 키-값 저장소. `timer` 키에 타이머 상태(`TimerState`)를 둔다.
// - history: 끝난 집중/휴식 세션의 이력(`HistoryEntry`). 키는 `id`이고, `startedAt` 인덱스가 있다.
//
// 배포한 뒤에는 이미 저장된 데이터를 읽지 못하게 되는 변경을 피한다.
// 저장소, 인덱스, 값의 모양을 바꿔야 하면 DATABASE_VERSION을 올리고 upgrade()에 단계를 덧붙인다.
// 이미 배포한 단계는 고치지 않는다.

export const DATABASE_NAME = "focus-timer";
const DATABASE_VERSION = 1;

export const STATE_STORE = "state";
export const HISTORY_STORE = "history";
/** history 저장소에서 시작 시각으로 찾는 인덱스 */
export const HISTORY_STARTED_AT_INDEX = "startedAt";

/** 다른 탭에 데이터가 바뀌었다고 알리는 채널 */
const CHANNEL_NAME = "focus-timer";

/** 데이터베이스를 처음 만들거나 예전 버전에서 올린다. 버전마다 차례로 적용한다. */
function upgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore(STATE_STORE);
    const history = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
    history.createIndex(HISTORY_STARTED_AT_INDEX, "startedAt");
  }
}

let database: Promise<IDBDatabase | null> | undefined;

/**
 * 데이터베이스 연결. 탭 안에서 하나를 열어 함께 쓴다.
 * IndexedDB를 쓸 수 없으면(막힌 브라우저, 더 새로운 버전의 데이터베이스) null이다.
 */
export function getDatabase(): Promise<IDBDatabase | null> {
  database ??= openDatabase().catch(() => null);
  return database;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      // 다른 탭에서 새 버전의 앱이 데이터베이스를 올리려 하면, 이 연결이 막지 않도록 닫는다.
      // 옛 코드로 계속 쓰면 데이터가 어긋나므로 새로고침해 새 코드를 받는다.
      // 사용자가 사이트 데이터를 지워 데이터베이스가 지워질 때도 여기로 온다.
      db.onversionchange = () => {
        db.close();
        location.reload();
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 트랜잭션이 커밋되면 이행하고, 취소되면 그 원인으로 거부한다. */
export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new DOMException("Transaction aborted", "AbortError"),
      );
  });
}

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  channel ??=
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** 다른 탭에 데이터가 바뀌었다고 알린다. 같은 탭에는 알리지 않는다. */
export function notifyChange(): void {
  getChannel()?.postMessage("change");
}

/**
 * 다른 탭에서 데이터를 바꾸면 `listener`를 부른다. 돌려받은 함수로 그만 듣는다.
 * 앱 버전이 다른 탭이 보낸 메시지일 수도 있으므로 메시지 내용은 보지 않는다.
 */
export function listenForChanges(listener: () => void): () => void {
  const target = getChannel();
  if (!target) return () => {};
  target.addEventListener("message", listener);
  return () => target.removeEventListener("message", listener);
}
