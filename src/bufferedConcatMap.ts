import { concatMap, defer, EMPTY, Observable, tap } from 'rxjs';

export function bufferConcatMap_<T, R>(project: (val: T[]) => Observable<R>) {
    return (sourceObservable: Observable<T>) =>
        new Observable<R>((subscriber) => {
            // this function will be called each time this
            // Observable is subscribed to.
            let bufferedNotifications = [] as T[];
            let processing = false;

            const subscription = sourceObservable
                .pipe(
                    tap((val) => {
                        bufferedNotifications.push(val);
                    }),
                    concatMap(() => {
                        // if processing or if there are no items in the buffer just complete without notifying anything
                        if (processing || bufferedNotifications.length === 0) {
                            return EMPTY;
                        }
                        processing = true;
                        const _buffer = [...bufferedNotifications];
                        bufferedNotifications = [];
                        return project(_buffer).pipe(
                            tap({
                                complete: () => {
                                    processing = false;
                                },
                            }),
                        );
                    }),
                )
                .subscribe({
                    next(value) {
                        subscriber.next(value);
                    },
                    error(err) {
                        // We need to make sure we're propagating our errors through.
                        subscriber.error(err);
                    },
                    complete() {
                        subscriber.complete();
                    },
                });

            // Return the teardown logic. This will be invoked when
            // the result errors, completes, or is unsubscribed.
            return () => {
                subscription.unsubscribe();
            };
        });
}

export function bufferConcatMap<T, R>(project: (val: T[], index: number, bufferIndex: number) => Observable<R>) {
    return (sourceObservable: Observable<T>) => {
        // buld the Observable returned by this operator
        return defer(() => {
            // this function will be called each time this Observable is subscribed to.

            // initialize the state - these variables will hold the state for every subscripition of the returned Observable
            let bufferedNotifications = [] as T[];
            let processing = false;
            let _index = -1; // index of the notification from upstream
            let _bufferIndex = 0; // index of the buffer passed to the project function
            return sourceObservable.pipe(
                tap((val) => {
                    // every value notified by the source is stored in the buffer
                    bufferedNotifications.push(val);
                    _index++;
                }),
                concatMap(() => {
                    // if processing or if there are no items in the buffer just complete without notifying anything
                    if (processing || bufferedNotifications.length === 0) {
                        return EMPTY;
                    }
                    // create a copy of the buffer to be passed to the project function so that the bufferedNotifications array
                    // can be safely reset
                    const _buffer = [...bufferedNotifications];
                    // update the state: now processing start and the bufferedNotifications needs to be reset
                    processing = true;
                    bufferedNotifications = [];
                    // return the result of the project function invoked with the buffer of values stored
                    return project(_buffer, _index, _bufferIndex).pipe(
                        tap({
                            // when the Observable returned by the project function completes it
                            // means that there is no processing on the fly
                            complete: () => {
                                _bufferIndex++;
                                processing = false;
                            },
                        }),
                    );
                }),
            );
        });
    };
}
