import { Observable, Subscriber } from 'rxjs';

export function transformFactoryFunction<R, T>(project: (arg0: R, i: number) => T) {
    // this function will be called each time this
    // Observable is subscribed to.
    return function (source: Observable<R>) {
        let index = 0;
        return new Observable((subscriber: Subscriber<T>) => {
            const subscription = source.subscribe({
                // this function will be called each time the source
                // Observable notifies.
                next: (value) => {
                    subscriber.next(project(value, index));
                    index++;
                },
                error: (err) => subscriber.error(err),
                complete: () => subscriber.complete(),
            });
            return () => {
                subscription.unsubscribe();
            };
        });
    };
}
