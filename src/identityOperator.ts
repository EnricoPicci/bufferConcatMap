import { Observable, Subscriber } from 'rxjs';

export function identity() {
    return function (source: Observable<any>) {
        return new Observable((subscriber: Subscriber<any>) => {
            const subscription = source.subscribe({
                next: (value) => subscriber.next(value),
                error: (err) => subscriber.error(err),
                complete: () => subscriber.complete(),
            });

            return () => {
                subscription.unsubscribe();
            };
        });
    };
}
