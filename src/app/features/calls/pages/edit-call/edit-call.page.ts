import { Component, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import {
	selectCallsState,
	selectEditCallDispatchesState,
	selectEditCallLocationState,
	selectHomeState,
	selectMessagesState,
	selectNewCallDispatchesState,
	selectNewCallLocationState,
	selectRecipientsState,
	selectSettingsState,
} from 'src/app/store';
import { MessagesState } from '../../../messages/store/messages.store';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import {
	MessageRecipientInput,
	MessageResultData,
	RecipientsResultData,
	UtilsService,
} from '@resgrid/ngx-resgridlib';
import { SubSink } from 'subsink';
import * as _ from 'lodash';
import { environment } from 'src/environments/environment';
import * as MessagesActions from '../../../messages/actions/messages.actions';
import { SettingsState } from 'src/app/features/settings/store/settings.store';
import { take } from 'rxjs/operators';
import { ModalController } from '@ionic/angular';
import { AlertProvider } from 'src/app/providers/alert';
import leaflet from 'leaflet';
import { GeolocationProvider } from 'src/app/providers/geolocation';
import { CallsState } from '../../store/calls.store';
import * as CallsActions from '../../actions/calls.actions';
import { GeoLocation } from 'src/app/models/geoLocation';
import { HomeState } from 'src/app/features/home/store/home.store';

@Component({
	selector: 'app-page-calls-edit-call',
	templateUrl: './edit-call.page.html',
	styleUrls: ['./edit-call.page.scss'],
})
export class EditCallPage {
	public callsState$: Observable<CallsState | null>;
	public homeState$: Observable<HomeState | null>;
	public dispatches$: Observable<RecipientsResultData[] | null>;
	public editCallLocation$: Observable<GeoLocation | null>;
	private subs = new SubSink();
	public note: string;
	public userId: string;
	public recipientList: string;
	public type: string = 'No Type';
	public priority: string = '0';
	public subject: string = '';
	public body: string = '';
	public callId: string = '';
	public contactName: string = '';
	public contactNumber: string = '';
	public address: string = '';
	public w3w: string = '';
	public redispatch: boolean = false;

	public mapImgWidth: number;
	public mapImgHeight: number;
	public mapImgSrc: string;
	public map: any;
	public marker: any;
	@ViewChild('callMap') mapContainer;

	constructor(
		private callsStore: Store<CallsState>,
		private homeStore: Store<HomeState>,
		private utilsProvider: UtilsService,
		private alertProvider: AlertProvider,
		private geolocationProvider: GeolocationProvider
	) {
		this.callsState$ = this.callsStore.select(selectCallsState);
		this.homeState$ = this.homeStore.select(selectHomeState);
		this.dispatches$ = this.callsStore.select(selectEditCallDispatchesState);
		this.editCallLocation$ = this.callsStore.select(selectEditCallLocationState);
	}

	async ionViewDidEnter() {
		this.callsStore.dispatch(new CallsActions.GetEditCallDispatches());

		this.recipientList = 'Select Recipients...';
		this.type = '0';
		this.subject = '';
		this.body = '';

		await this.initMap();

		this.subs.sink = this.editCallLocation$.subscribe((editCallLocation) => {
			if (editCallLocation && this.map && this.marker) {
				if (this.map.hasLayer(this.marker)) {
					this.map.removeLayer(this.marker);
				}

				this.marker = leaflet.marker(
					[editCallLocation.Latitude, editCallLocation.Longitude],
					{
						icon: new leaflet.icon({
							iconUrl: '/assets/images/mapping/Call.png',
							iconSize: [32, 37],
							iconAnchor: [16, 37],
						}),
						draggable: false,
					}
				);

				this.marker.addTo(this.map);
				this.map.setView(
					[editCallLocation.Latitude, editCallLocation.Longitude],
					16
				);
			}
		});

		this.subs.sink = this.dispatches$.subscribe((recipients) => {
			if (recipients && recipients.length > 0) {
				this.recipientList = '';

				recipients.forEach((recipient) => {
					if (recipient.Selected) {
						if (this.recipientList.length > 0) {
							this.recipientList += ', ' + recipient.Name;
						} else {
							this.recipientList += recipient.Name;
						}
					}
				});

				if (this.recipientList.length === 0) {
					this.recipientList = 'Select Recipients...';
				}
			} else {
				this.recipientList = 'Select Recipients...';
			}
		});

		this.callsState$.pipe(take(1)).subscribe((callsState) => {
			if (callsState && callsState.callToView) {
				this.type = callsState.callToView.Type;
				this.priority = callsState.callToView.Priority.toString();
				this.subject = callsState.callToView.Name;
				this.body = callsState.callToView.Nature;
				this.callId = callsState.callToView.CallId;
				this.contactName = callsState.callToView.ContactName;
				this.contactNumber = callsState.callToView.ContactInfo;
				this.address = callsState.callToView.Address;
				this.w3w = callsState.callToView.What3Words;
			}

			if (callsState && callsState.callViewData && callsState.callViewData.Dispatches) {
				this.callsStore.dispatch(new CallsActions.SetEditCallDispatches(callsState.callViewData.Dispatches));
			}
		});
	}

	ionViewDidLeave() {
		if (this.subs) {
			this.subs.unsubscribe();
		}
	}

	public closeModal() {
		this.callsStore.dispatch(new CallsActions.CloseEditCallModal());
	}

	public selectRecipients() {
		this.callsStore.dispatch(new CallsActions.ShowEditCallSelectDispatches());
	}

	public send() {
		if (this.subject.length === 0) {
			this.alertProvider.showErrorAlert(
				'New Call Error',
				'',
				'You must supply a name for the call.'
			);
			return;
		}
		if (this.body.length === 0) {
			this.alertProvider.showErrorAlert(
				'New Call Error',
				'',
				'You must supply a nature for the call.'
			);
			return;
		}
		this.callsState$.pipe(take(1)).subscribe((callsState) => {
			let dispatchList = '';

			if (callsState &&
				callsState.editCallWhoDispatch &&
				callsState.editCallWhoDispatch.length > 0
			) {
				callsState.editCallWhoDispatch.forEach((recipient) => {
					if (recipient.Selected) {
						if (dispatchList.length > 0) {
							dispatchList = dispatchList.concat(`|${recipient.Id}`);
						} else {
							dispatchList = `${recipient.Id}`;
						}
					}
				});
			}

			this.callsState$.pipe(take(1)).subscribe((callsState2) => {
				if (callsState2) {
					if (callsState2.editCallLocation) {
						this.callsStore.dispatch(
							new CallsActions.UpdateCall(
								callsState2.callToView.CallId,
								this.subject,
								parseInt(this.priority, 10),
								this.type,
								this.contactName,
								this.contactNumber,
								this.callId,
								null,
								null,
								this.body,
								null,
								this.address,
								this.w3w,
								callsState2.editCallLocation.Latitude,
								callsState2.editCallLocation.Longitude,
								dispatchList,
								null,
								null,
								this.redispatch
							)
						);
					} else {
						this.callsStore.dispatch(
							new CallsActions.UpdateCall(
								callsState2.callToView.CallId,
								this.subject,
								parseInt(this.priority, 10),
								this.type,
								this.contactName,
								this.contactNumber,
								this.callId,
								null,
								null,
								this.body,
								null,
								this.address,
								this.w3w,
								null,
								null,
								dispatchList,
								null,
								null,
								this.redispatch
							)
						);
					}
				}
			});
		});
	}

	private async initMap() {
		let position = await this.geolocationProvider.getLocation();

		if (this.map) {
			this.map.off();
			this.map.remove();
			this.map = null;
		}

		if (!position) {
			position = new GeoLocation(0,0);
		} //TODO: Stop gap, should get a location from the department info somewhere

		if (position) {
			this.callsStore.dispatch(
				new CallsActions.SetNewCallLocation(
					position.Latitude,
					position.Longitude
				)
			);
		}

		this.map = leaflet.map(this.mapContainer.nativeElement, {
			dragging: false,
			doubleClickZoom: false,
			zoomControl: false,
		});

		leaflet
			.tileLayer(
				'https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=' +
					environment.mapTilerKey,
				{
					minZoom: 16,
					maxZoom: 16,
					crossOrigin: true,
				}
			)
			.addTo(this.map);

		if (position) {
			this.map.setView([position.Latitude, position.Longitude], 16);

			this.marker = leaflet.marker([position.Latitude, position.Longitude], {
				icon: new leaflet.icon({
					iconUrl: '/assets/images/mapping/Call.png',
					iconSize: [32, 37],
					iconAnchor: [16, 37],
				}),
				draggable: false,
			});

			this.marker.addTo(this.map);
		}

		const that = this;
		setTimeout( () => that.map.invalidateSize(), 500 );
	}

	public showSetLocationModal() {
		this.callsStore.dispatch(new CallsActions.ShowSetLocationModal());
	}
}